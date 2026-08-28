# Real supplied-source validation — 2026-08-28

This validation replays recorded source packets assembled from public web pages on 2026-08-28 and passes bounded URLs, titles, publication dates where available, and short evidence excerpts to `runResearchFromSources`. The script itself performs no network retrieval and does not independently verify that an excerpt still matches its page at run time. It does not use the repository's standard research fixtures, Brave, Tavily, or a hosted search adapter. The reproducible input and assertions live in `scripts/validate-real-supplied.mjs`.

These trials validate input handling, entity precision, lineage, conservative complaint treatment, stopping behavior, and zero-provider accounting. They do not prove that a generated market opportunity is commercially accurate. Vendor-authored claims remain vendor claims unless independently corroborated.

## Results

| Trial | Sources | Competitor result | False competitors | Complaint result | Citation result | Stop decision | Provider calls |
| --- | ---: | --- | --- | --- | --- | --- | ---: |
| Established roofing field-service software | 8 | Jobber, Housecall Pro, and ServiceTitan identified from company-controlled pages | 0 | One isolated manual-workaround cluster; no recurrence inferred | 0 broken competitor or claim evidence IDs; major-claim coverage 0.818 | `insufficient_evidence` because no repeated residual-demand gap cleared the gate | 0 |
| Narrow aquaculture ozone-maintenance software | 7 | YSI, EcoQuant Systems, ELDI, and aquaManager identified from product/company pages | 0 | No customer complaint cluster | 0 broken competitor or claim evidence IDs; major-claim coverage 0.778 | `insufficient_evidence`; user-voice and commercial evidence were missing | 0 |
| COI tracking with misleading rankings and directories | 9 | Certificial and Jones identified from direct company/product pages | 0 | One firsthand source produced isolated clusters; duplicated research prompts did not establish recurrence | 0 broken competitor or claim evidence IDs; major-claim coverage 0.727 | `insufficient_evidence`; no repeated gap cleared the gate | 0 |

The COI trial intentionally included four vendor/listicle/comparison pages and two nearly identical discussion prompts. None of the listicle publishers, article titles, directories, or Reddit pages became competitors. One duplicated discussion page was collapsed, and question-only market-research prompts were excluded from firsthand complaint evidence.

## Representative source set

### Established market

- [Jobber roofing software](https://www.getjobber.com/industries/roofing-software/)
- [Jobber pricing](https://www.getjobber.com/pricing/)
- [Housecall Pro pricing](https://www.housecallpro.com/pricing/)
- [Housecall Pro product documentation](https://help.housecallpro.com/en/articles/7919484-settings-page-overview)
- [ServiceTitan roofing software](https://www.servicetitan.com/industries/roofing-software)
- [Limited contractor discussion: Housecall Pro or Jobber](https://www.reddit.com/r/Contractor/comments/1o8hq6p/which_one_would_you_pick_housecall_pro_or_jobber/)
- [Limited contractor discussion: Housecall Pro fit](https://www.reddit.com/r/Contractor/comments/1fmrr7o/is_anyone_using_housecall_pro_is_it_worth_it/)
- [Independent Jobber review](https://www.techradar.com/pro/software-services/jobber-crm-review)

### Narrow market

- [Manitoba fish-farm maintenance-log manual](https://www.gov.mb.ca/agriculture/livestock/aquaculture/pubs/fishfarmtechtrain-manual.pdf)
- [YSI AquaManager](https://www.ysi.com/aquamanager)
- [EcoQuant aquaculture platform](https://www.ecoquantsystems.com/aquaculture)
- [ELDI Aquacom](https://www.eldi.com/products/Aquacom)
- [aquaManager platform](https://www.aqua-manager.com/platform/)
- [aquaManager i-Maint](https://am.sites.asterias.gr/software/i-maint/)
- [University-hosted hatchery manual](https://www.gu.se/sites/default/files/2020-05/Hatchery%20manual.pdf)

### Misleading-page market

- [Certificial](https://www.certificial.com/)
- [Jones Network](https://getjones.com/jones-network/)
- [Vendor-authored myCOI alternatives ranking](https://www.certificial.com/blog-post/best-mycoi-alternatives-2026)
- [CoiLoop comparison](https://www.coiloop.com/compare/best-coi-tracking-software)
- [TrackMyVendor comparison](https://trackmyvendor.com/compare-coi-tracking-software)
- [Indie Hackers comparison post](https://www.indiehackers.com/post/best-coi-tracking-software-2026-i-compared-10-platforms-and-ranked-every-option-for-vendor-insurance-compliance-0c694b2679)
- [Duplicated discussion prompt A](https://www.reddit.com/r/PptyMgmtSoftware/comments/1v9tz8k/how_is_everyone_actually_tracking/)
- [Duplicated discussion prompt B](https://www.reddit.com/r/Insurance_Companies/comments/1vaa2rv/how_is_everyone_actually_tracking/)
- [Firsthand construction-management discussion](https://www.reddit.com/r/ConstructionManagers/comments/1om1rn7/new_pm_here_am_i_crazy_or_is_tracking_sub/)

## Interpretation

All three runs stopped conservatively instead of manufacturing an opportunity from competitor presence, vendor marketing, one complaint, or missing competitors. Each output still contained a market overview, explicit unknowns, risk structure, validation-test structure, and a next action requesting the missing evidence family.
