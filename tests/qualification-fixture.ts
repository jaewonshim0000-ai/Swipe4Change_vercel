import { QualificationDetails } from '../src/domain/qualification';
export const qualificationFixture: QualificationDetails = {
  jurisdiction: 'Sample County, CA (fictional)',
  authority: 'Sample Elections Office (fictional)',
  measureId: 'DEMO-2027-01',
  officialTitle: 'Fictional crosswalk initiative for test purposes',
  officialText:
    'This fictional measure asks the sample jurisdiction to install a crosswalk at the school entrance. This is sample text, not an approved legal measure.',
  sourceUrl: 'https://example.org/fictional-measure',
  statutoryRule:
    'Fictional test rule: two accepted signatures are required. This is not a statement of actual law.',
  statutoryThreshold: 2,
  circulatorDeclaration:
    'For this fictional test declaration, I personally witnessed each selected signer execute the signature and affirm the stated facts.',
  notarization: 'required',
};
