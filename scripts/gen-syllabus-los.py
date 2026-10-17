#!/usr/bin/env python3
"""Generates data/syllabus_los.json. Labels are the project's own short paraphrases (not syllabus wording).
`anchor` is a short verbatim tail of the LO used ONLY to machine-check page and intellectual level (scripts/check-los.js)."""
import json

areas = {'A': 'Fundamental ethical and professional principles', 'B': 'The financial reporting framework', 'C': 'Reporting the financial performance of a range of entities', 'D': 'Financial statements of groups of entities', 'E': 'Interpret financial and non-financial information for different stakeholders', 'F': 'The impact of changes and potential changes in accounting regulation', 'G': 'Employability and technology skills'}
sections = {'A1': 'Professional and ethical behaviour in corporate reporting', 'B1': 'Applications, strengths and weaknesses of an accounting framework', 'C1': 'Revenue', 'C2': 'Non-current assets', 'C3': 'Financial instruments', 'C4': 'Leases', 'C5': 'Employee benefits', 'C6': 'Income taxes', 'C7': 'Provisions, contingencies and events after the reporting period', 'C8': 'Share-based payment', 'C9': 'Fair value measurement', 'C10': 'Presentation and disclosure in financial statements', 'C11': 'Other reporting issues', 'D1': 'Group accounting including statements of cash flows', 'D2': 'Associates and joint arrangements', 'D3': 'Foreign transactions and entities', 'E1': 'Analysis and interpretation of financial and non-financial information and measurement of performance', 'F1': 'Discussion of issues in financial reporting', 'G': 'Employability and technology skills'}

L = [
 ('A1a', 'Why ethical and professional behaviour matters for complying with accounting and sustainability standards', 3, 7, 'in contemporary business scenarios', ['ethic', 'professional', 'behaviour', 'compliance', 'sustainability']),
 ('A1b', 'Consequences of unethical behaviour by management in preparing corporate reports', 3, 7, 'preparation of corporate reports', ['unethical', 'management', 'consequence']),
 ('B1a', 'Role of the Conceptual Framework in underpinning accounting standards', 3, 7, 'production of accounting standards', ['conceptual framework', 'standards']),
 ('B1b', 'Objectives, principles and limits of financial reporting, including presentation and disclosure', 3, 7, 'presentation and disclosure of information', ['objective', 'limitation', 'disclosure']),
 ('B1c', 'Qualitative characteristics of useful financial information', 3, 7, 'including disclosure', ['qualitative', 'characteristic', 'useful']),
 ('B1d', 'Recognition, derecognition and measurement principles, measurement uncertainty and materiality', 3, 7, 'measurement uncertainty and materiality', ['recognition', 'derecognition', 'measurement', 'materiality']),
 ('B1e', 'Definitions of the elements of financial statements and items in profit or loss and OCI', 3, 7, 'other comprehensive income', ['element', 'definition', 'profit', 'comprehensive']),
 ('C1a', 'Criteria to be met before revenue is recognised', 3, 7, 'can recognise revenue', ['revenue', 'recognise', 'criteria']),
 ('C1b', 'Contract revenue and contract cost recognition, including modifications', 3, 7, 'including contract modifications', ['contract', 'revenue', 'modification']),
 ('C1c', 'Revenue measurement topics: over-time obligations, returns, repurchase, consignment, warranties, variable consideration, principal v agent, upfront fees', 3, 7, 'non-refundable upfront fees', ['performance obligation', 'warranty', 'consignment', 'agent', 'variable consideration']),
 ('C2a', 'Recognition, derecognition and measurement of non-current assets, impairments and revaluations', 3, 7, 'including impairments and revaluations', ['non-current', 'impairment', 'revaluation']),
 ('C2b', 'Classification and measurement of non-current assets held for sale', 3, 7, 'held for sale', ['held for sale']),
 ('C2c', 'Investment properties: classification, recognition, measurement, change of use', 3, 7, 'change of use', ['investment property']),
 ('C2d', 'Intangible assets: recognition criteria and subsequent measurement', 3, 7, 'subsequent to acquisition', ['intangible']),
 ('C2e', 'Borrowing costs', 2, 8, 'for borrowing costs', ['borrowing cost']),
 ('C3a', 'Initial recognition and measurement of financial instruments, business model test', 3, 8, 'including the business model test', ['financial instrument', 'business model']),
 ('C3b', 'Subsequent measurement of financial assets and liabilities, fair value option, liability modifications', 3, 8, 'financial liability modifications', ['subsequent measurement', 'fair value option', 'modification']),
 ('C3c', 'Derecognition of financial assets and financial liabilities', 2, 8, 'derecognition of financial assets and financial liabilities', ['derecognition']),
 ('C3d', 'Reclassification of financial assets', 2, 8, 'reclassification of financial assets', ['reclassification']),
 ('C3e', 'Accounting for derivative financial instruments', 2, 8, 'derivative financial instruments', ['derivative']),
 ('C3f', 'Hedge accounting criteria, fair value and cash flow hedges, effectiveness', 2, 8, 'including hedge effectiveness', ['hedge', 'effectiveness']),
 ('C3g', 'General approach to impairment of financial instruments, expected credit losses', 2, 8, 'expected credit losses', ['impairment', 'expected credit loss']),
 ('C3h', 'Implications of a significant increase in credit risk', 2, 8, 'significant increase in credit risk', ['credit risk']),
 ('C3i', 'Purchased or originated credit-impaired financial assets', 2, 8, 'originated credit impaired financial assets', ['credit impaired']),
 ('C4a', 'Lessee accounting: identifying a lease, right-of-use asset and lease liability', 3, 8, 'right-of-use asset and lease liability', ['lessee', 'right-of-use', 'lease liability']),
 ('C4b', 'Lessor accounting including subleases', 3, 8, 'including accounting for subleases', ['lessor', 'sublease']),
 ('C4c', 'Re-measurement of the lease liability', 3, 8, 're-measurement of the lease liability', ['re-measurement', 'lease liability']),
 ('C4d', 'Separating lease and non-lease components', 3, 8, 'lease and non-lease elements', ['non-lease', 'component']),
 ('C4e', 'Recognition exemptions in the leasing standard', 3, 8, 'under the current leasing standard', ['exemption', 'lease']),
 ('C4f', 'Sale and leaseback transactions', 3, 8, 'sale and leaseback transactions', ['sale and leaseback']),
 ('C5a', 'Short and long-term employee benefits, termination benefits, defined contribution and defined benefit plans', 3, 8, 'defined contribution and defined benefit plans', ['employee benefit', 'defined benefit', 'termination']),
 ('C5b', 'Gains and losses on settlements and curtailments', 2, 8, 'settlements and curtailments', ['settlement', 'curtailment']),
 ('C5c', 'Asset ceiling test and reporting of actuarial gains and losses', 2, 8, 'reporting of actuarial gains and losses', ['asset ceiling', 'actuarial']),
 ('C6a', 'Current and deferred tax liabilities and assets: recognition and measurement', 3, 8, 'deferred tax liabilities and assets', ['deferred tax', 'current tax']),
 ('C6b', 'Deferred tax on a business combination', 2, 8, 'deferred taxation on a business combination', ['deferred', 'business combination']),
 ('C7a', 'Provisions, contingent liabilities and assets, onerous contracts, environmental and restructuring provisions', 3, 9, 'restructuring provisions', ['provision', 'contingent', 'onerous', 'restructuring']),
 ('C7b', 'Events after the reporting period', 3, 9, 'events after the reporting period', ['events after']),
 ('C8a', 'Share-based payment recognition and measurement', 3, 9, 'share-based payment transactions', ['share-based']),
 ('C9a', 'Fair value measurement principles and active market', 3, 9, "active market'", ['fair value', 'active market']),
 ('C9b', 'Fair value hierarchy and valuation techniques', 3, 9, 'including valuation techniques', ['hierarchy', 'valuation technique']),
 ('C9c', 'Highest and best use, most advantageous and principal market', 3, 9, 'most advantageous and principal market', ['highest and best use', 'principal market']),
 ('C10a', 'Format, content and presentation of the statement of profit or loss and OCI', 3, 9, 'statement of profit or loss and other comprehensive income', ['profit or loss', 'presentation']),
 ('C10b', 'Format and presentation of the statement of financial position, current v non-current', 3, 9, 'current or non-current', ['financial position', 'current']),
 ('C10c', 'Format, content and presentation of the statement of cash flows', 3, 9, 'presentation of the statement of cash flows', ['cash flow']),
 ('C10d', 'Aggregation, disaggregation and offsetting in statements and notes', 3, 9, 'financial statements and disclosure notes', ['aggregation', 'disaggregation', 'offsetting']),
 ('C10e', 'Principles that maximise the usefulness of disclosure notes', 3, 9, 'usefulness of disclosure notes', ['disclosure', 'notes']),
 ('C10f', 'Disclosure of management-defined performance measures', 3, 9, 'management-defined performance measures', ['management-defined']),
 ('C11a', 'Government grants and other government assistance', 3, 9, 'other forms of government assistance', ['government grant']),
 ('C11b', 'Accounting policies, changes in estimates and prior period errors', 3, 9, 'prior period errors', ['accounting policies', 'estimate', 'error']),
 ('C11c', 'Going concern', 3, 9, 'relating to going concern', ['going concern']),
 ('C11d', 'Related parties and implications of related party relationships', 2, 9, 'preparation of corporate reports', ['related part']),
 ('C11e', 'Differences between full IFRS Accounting Standards and the IFRS for SMEs Standard', 2, 9, 'IFRS for SMEs Standard', ['sme']),
 ('D1a', 'Determining whether a business combination has occurred; control principle', 3, 9, 'including the control principle', ['control', 'business combination']),
 ('D1b', 'Acquisition method, identifying the acquirer, cost of a business combination', 3, 10, 'cost of a business combination', ['acquisition method', 'acquirer']),
 ('D1c', 'Recognition and measurement of acquired assets and liabilities, contingent amounts, intangibles', 3, 10, 'contingent amounts and intangible assets', ['acquired', 'contingent', 'intangible']),
 ('D1d', 'Goodwill and non-controlling interests', 3, 10, 'goodwill and non-controlling interests', ['goodwill', 'non-controlling']),
 ('D1e', 'Business combination achieved in stages', 3, 10, 'business combination achieved in stages', ['stages']),
 ('D1f', 'Procedures for preparing consolidated financial statements', 3, 10, 'preparing consolidated financial statements', ['consolidated']),
 ('D1g', 'Changes in ownership interest, loss of control or significant influence', 3, 10, 'loss of control or significant influence', ['ownership', 'loss of control']),
 ('D1h', 'Impact of discontinued activities on group financial statements', 3, 10, 'activities have been discontinued', ['discontinued']),
 ('D1i', 'Subsidiary acquired exclusively with a view to subsequent disposal', 2, 10, 'subsequent disposal', ['subsequent disposal']),
 ('D1j', 'Group companies in the parent separate financial statements', 2, 10, 'separate financial statements of the parent company', ['separate financial statements', 'parent']),
 ('D1k', 'Reduced disclosures for a subsidiary in its separate financial statements', 1, 10, 'in its separate financial statements', ['reduced disclosures', 'subsidiary']),
 ('D1l', 'Exemption from preparing consolidated financial statements', 2, 10, 'preparation of consolidated financial statements', ['exemption', 'consolidated']),
 ('D1m', 'Consolidated statement of cash flows: format, content, presentation', 3, 10, 'consolidated statement of cash flows', ['consolidated statement of cash flows']),
 ('D2a', 'Significant influence and the equity method for associates', 3, 10, 'equity method of accounting for associates', ['significant influence', 'equity method', 'associate']),
 ('D2b', 'Joint control and classification of joint arrangements', 3, 10, 'classification of joint arrangements', ['joint control', 'joint arrangement']),
 ('D3a', 'Translating foreign currency transactions into functional and presentation currency', 3, 10, 'the functional currency and the presentation currency', ['functional currency', 'presentation currency']),
 ('D3b', 'Consolidating foreign operations and their disposal', 3, 10, 'and their disposal', ['foreign operation']),
 ('E1a', 'Financial and non-financial performance indicators from stakeholder perspectives, EPS, management-defined and additional performance measures', 3, 10, 'other additional performance measures', ['earnings per share', 'performance measure', 'stakeholder']),
 ('E1b', 'Reportable segments and usefulness of operating segment disclosures', 3, 10, 'operating segment disclosures to stakeholders', ['segment']),
 ('E1c', 'Factors affecting quality of financial and non-financial information for investors, incl. management commentary and sustainability disclosures', 3, 11, 'IFRS Sustainability Disclosure Standards', ['quality', 'management commentary', 'investor']),
 ('F1a', 'Accounting implications of adopting new accounting standards', 2, 11, 'adoption of new accounting standards', ['adoption', 'new accounting standard']),
 ('F1b', 'Applying existing standards to contemporary issues: digital assets, natural disasters, climate change, global events', 3, 11, 'global events', ['digital asset', 'climate', 'natural disaster']),
 ('F1c', 'IFRS Sustainability Disclosure Standards: scope, content, climate disclosures, differences from ESRS', 3, 11, 'European Sustainability Reporting Standards', ['sustainability disclosure', 'climate-related', 'esrs']),
 ('G1', 'Use computer technology to access and manipulate information', None, 11, 'access and manipulate relevant information', ['computer', 'technology']),
 ('G2', 'Work on response options using available functions and technology', None, 11, 'as would be required in the workplace', ['response options']),
 ('G3', 'Navigate windows and screens to create and amend exam responses', None, 11, 'create and amend responses to exam requirements', ['navigate']),
 ('G4', 'Present data and information effectively using appropriate tools', None, 11, 'Present data and information effectively', ['present data']),
]


def section_of(i):
    if i[0] == 'G':
        return 'G'
    return i[0] + ''.join(ch for ch in i[1:] if ch.isdigit())


los = [{'id': i, 'area': i[0], 'areaName': areas[i[0]], 'section': sections[section_of(i)], 'label': label, 'level': lvl, 'page': pg, 'anchor': anc, 'keywords': kw} for i, label, lvl, pg, anc, kw in L]
non = [
 {'id': 'S7', 'area': 'S', 'areaName': 'Syllabus approach and exam structure', 'section': 'Approach to examining the syllabus (section 7)', 'label': 'Exam duration, sections, marks and professional skills marks', 'page': 12, 'keywords': ['section a', 'section b', 'professional skills marks', 'scenario']},
 {'id': 'S9', 'area': 'S', 'areaName': 'Syllabus approach and exam structure', 'section': 'Examination structure and delivery (section 9)', 'label': 'Pass mark and SBR delivery format', 'page': 14, 'keywords': ['pass mark', 'three-hour']},
 {'id': 'S11', 'area': 'S', 'areaName': 'Syllabus approach and exam structure', 'section': 'Examination assessment and examinability (section 11)', 'label': 'Which regulations are examinable and when', 'page': 17, 'keywords': ['examinable', 'issued', 'effective']},
]
json.dump({'source': 'ACCA-SYL-SBRINT-2627', 'note': "Labels are the project's own short paraphrases, not syllabus wording. The anchor is a short verbatim tail used only to machine-check the page and intellectual level against the ingested syllabus text.", 'los': los, 'nonLO': non}, open('data/syllabus_los.json', 'w'), indent=1)
print(len(los), 'learning outcomes written')
