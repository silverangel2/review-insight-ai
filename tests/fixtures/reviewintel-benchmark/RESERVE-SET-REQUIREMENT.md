# Sealed reserve-set requirement (2026-10-10)

The four products used in the Owner-approved live runs of 2026-10-10 were inspected
and code was changed in response to them. They are now DEVELOPMENT cases, not blind:

- Epson Lifestudio Pop Plus — amazon.ca/dp/B0FNHDT93H
- Sony WH-1000XM5 Black — amazon.ca/dp/B09XS7JWHH
- Instant Pot Duo 6qt (IP-DUO60) — amazon.ca/dp/B00FLYWNYQ
- DEWALT DCD771C2 — amazon.ca/dp/B00ET5VMTU
(lock: /private/tmp/reviewintel-reserve2-lock-luca-20261010.json, sha256 4cbc8b56…8d35)

Before any further claim of generalisation, a NEW reserve set must be sealed:
1. Choose products never inspected by the developer, across categories, sold at
   multiple public retailers (Amazon + Walmart/Best Buy/Home Depot/Canadian Tire).
2. Write product list + URLs + sha256 to a lock file BEFORE any run or inspection.
3. Run each once; report results as-is; do not tune code to them. Any fix made after
   inspecting them demotes that set to development, and a new reserve set is required.
