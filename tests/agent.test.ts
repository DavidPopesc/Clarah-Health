import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { demoRecord, demoWearable } from "../src/lib/demo-data.ts";
import type { AgentEvent } from "../src/lib/agent.ts";

test("chat handles Gemini tool streams and provider fallback", async (suite) => {
  const requests: { model: string; messages: Record<string, unknown>[] }[] = [];
  let replies: Record<string, unknown>[][] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body));
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    for (const choice of replies.shift() ?? []) {
      response.write(`data: ${JSON.stringify({ choices: [choice] })}\n\n`);
    }
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseURL = `http://127.0.0.1:${address.port}/v1/`;
  const settings = {
    GEMINI_API_KEY: "test-gemini",
    GEMINI_BASE_URL: baseURL,
    GEMINI_MODEL: "test-gemini-model",
    OPENAI_API_KEY: "test-backup",
    OPENAI_BASE_URL: baseURL,
    OPENAI_MODEL: "test-backup-model",
  };
  const previous = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);

  try {
    const { runAgent } = await import("../src/lib/agent.ts");
    const run = async () => {
      const events: AgentEvent[] = [];
      await runAgent([{ role: "user", content: "What is my A1c?" }], demoRecord, demoWearable(), (event) => events.push(event));
      return events;
    };

    await suite.test("executes indexless parallel tool calls and preserves thought signatures", async () => {
      requests.length = 0;
      const signature = { google: { thought_signature: "test-signature" } };
      replies = [
        [
          { delta: { tool_calls: [{ id: "labs", type: "function", function: { name: "get_labs", arguments: "{}" }, extra_content: signature }] } },
          { delta: { tool_calls: [{ id: "conditions", type: "function", function: { name: "get_conditions", arguments: "{}" } }] } },
          { delta: {}, finish_reason: "stop" },
        ],
        [{ delta: { content: "Your A1c is 7.4%." }, finish_reason: "stop" }],
      ];
      const events = await run();
      assert.equal(requests.length, 2);
      assert.equal(requests[1].model, "test-gemini-model");
      const assistant = requests[1].messages.find((message) => message.role === "assistant");
      assert.deepEqual(assistant?.tool_calls, [
        { id: "labs", type: "function", function: { name: "get_labs", arguments: "{}" }, extra_content: signature },
        { id: "conditions", type: "function", function: { name: "get_conditions", arguments: "{}" } },
      ]);
      const results = requests[1].messages.filter((message) => message.role === "tool");
      assert.deepEqual(results.map((message) => message.tool_call_id), ["labs", "conditions"]);
      assert.match(String(results[0].content), /7.4/);
      assert.ok(events.some((event) => event.type === "delta" && event.text === "Your A1c is 7.4%."));
      assert.equal(events.at(-1)?.type, "done");
    });

    await suite.test("falls back when Gemini ends without text or tool calls", async () => {
      requests.length = 0;
      replies = [
        [{ delta: {}, finish_reason: "stop" }],
        [{ delta: { content: "Here is your answer." }, finish_reason: "stop" }],
      ];
      const events = await run();
      assert.deepEqual(requests.map((request) => request.model), ["test-gemini-model", "test-backup-model"]);
      assert.ok(events.some((event) => event.type === "delta" && event.text === "Here is your answer."));
    });

    await suite.test("keeps indexed argument fragments together", async () => {
      requests.length = 0;
      replies = [
        [
          { delta: { tool_calls: [{ index: 0, id: "reference", type: "function", function: { name: "lookup_safety_reference", arguments: '{"query":' } }] } },
          { delta: { tool_calls: [{ index: 0, function: { arguments: '"blood pressure"}' } }] } },
          { delta: {}, finish_reason: "tool_calls" },
        ],
        [{ delta: { content: "I checked the reference." }, finish_reason: "stop" }],
      ];
      await run();
      const assistant = requests[1].messages.find((message) => message.role === "assistant");
      assert.deepEqual(assistant?.tool_calls, [{ id: "reference", type: "function", function: { name: "lookup_safety_reference", arguments: '{"query":"blood pressure"}' } }]);
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
