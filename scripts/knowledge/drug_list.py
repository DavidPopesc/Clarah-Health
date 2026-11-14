"""Commonly used U.S. medications (generic names, lowercase) to pull FDA labels for.

Roughly the most-prescribed outpatient drugs plus common over-the-counter medicines and the
demo patient's medications. Add names here and re-run fetch_knowledge.py drugs.
"""

DRUGS = [
    # Diabetes
    "metformin", "glipizide", "glimepiride", "glyburide", "pioglitazone", "sitagliptin",
    "linagliptin", "empagliflozin", "dapagliflozin", "canagliflozin", "semaglutide",
    "liraglutide", "dulaglutide", "tirzepatide", "insulin glargine", "insulin lispro",
    "insulin aspart", "insulin detemir",
    # Blood pressure / heart
    "lisinopril", "enalapril", "ramipril", "benazepril", "losartan", "valsartan",
    "irbesartan", "olmesartan", "telmisartan", "amlodipine", "nifedipine", "diltiazem",
    "verapamil", "metoprolol", "carvedilol", "atenolol", "propranolol", "bisoprolol",
    "nebivolol", "labetalol", "hydrochlorothiazide", "chlorthalidone", "furosemide",
    "torsemide", "bumetanide", "spironolactone", "eplerenone", "hydralazine", "clonidine",
    "isosorbide mononitrate", "nitroglycerin", "digoxin", "amiodarone", "sacubitril",
    "ranolazine",
    # Cholesterol
    "atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "lovastatin",
    "ezetimibe", "fenofibrate", "gemfibrozil", "icosapent ethyl",
    # Blood thinners
    "warfarin", "apixaban", "rivaroxaban", "dabigatran", "clopidogrel", "ticagrelor",
    "prasugrel", "aspirin",
    # Pain / inflammation
    "acetaminophen", "ibuprofen", "naproxen", "meloxicam", "celecoxib", "diclofenac",
    "tramadol", "oxycodone", "hydrocodone", "morphine", "cyclobenzaprine", "methocarbamol",
    "tizanidine", "baclofen", "prednisone", "methylprednisolone", "colchicine",
    "allopurinol", "febuxostat",
    # Nerve pain / seizures
    "gabapentin", "pregabalin", "topiramate", "lamotrigine", "levetiracetam",
    "carbamazepine", "oxcarbazepine", "valproic acid", "phenytoin",
    # Mental health / sleep
    "sertraline", "escitalopram", "citalopram", "fluoxetine", "paroxetine", "venlafaxine",
    "duloxetine", "desvenlafaxine", "bupropion", "mirtazapine", "trazodone", "amitriptyline",
    "nortriptyline", "buspirone", "hydroxyzine", "alprazolam", "lorazepam", "clonazepam",
    "diazepam", "zolpidem", "quetiapine", "aripiprazole", "olanzapine", "risperidone",
    "lithium", "methylphenidate", "amphetamine", "atomoxetine",
    # Stomach / gut
    "omeprazole", "pantoprazole", "esomeprazole", "lansoprazole", "famotidine",
    "ondansetron", "metoclopramide", "loperamide", "docusate", "polyethylene glycol",
    "bisacodyl", "sennosides", "dicyclomine", "mesalamine",
    # Allergy / lungs
    "cetirizine", "loratadine", "fexofenadine", "diphenhydramine", "montelukast",
    "fluticasone", "budesonide", "albuterol", "tiotropium", "ipratropium",
    "benzonatate", "guaifenesin", "dextromethorphan", "pseudoephedrine",
    # Antibiotics / antivirals
    "amoxicillin", "amoxicillin and clavulanate", "azithromycin", "doxycycline",
    "cephalexin", "ciprofloxacin", "levofloxacin", "sulfamethoxazole and trimethoprim",
    "nitrofurantoin", "metronidazole", "clindamycin", "valacyclovir", "acyclovir",
    "oseltamivir", "fluconazole", "nirmatrelvir",
    # Thyroid / hormones / bones
    "levothyroxine", "methimazole", "estradiol", "medroxyprogesterone", "norethindrone",
    "progesterone", "testosterone", "alendronate", "raloxifene",
    # Urology / kidney
    "tamsulosin", "finasteride", "oxybutynin", "tolterodine", "sildenafil", "tadalafil",
    "potassium chloride",
    # Vitamins and minerals (label data is limited for these)
    "cyanocobalamin", "ergocalciferol", "folic acid", "ferrous sulfate",
    # Other common
    "hydroxychloroquine", "methotrexate", "sumatriptan", "rizatriptan", "donepezil",
    "memantine", "ropinirole", "pramipexole", "carbidopa and levodopa", "varenicline",
    "naltrexone", "buprenorphine", "epinephrine", "triamcinolone", "mupirocin",
]
