// api/_lib/report/core/merchantIdentity.js
// Extracts client identity from the submitted program context.

export function parseMerchantIdentity(programContext = '') {
  return {
    companyName:  programContext.match(/Company:\s*(.+)/)?.[1]?.trim() || '-',
    contactName:  programContext.match(/Name:\s*(.+)/)?.[1]?.trim() || '-',
    merchantEmail: programContext.match(/Email:\s*(.+)/)?.[1]?.trim() || '-'
  };
}
