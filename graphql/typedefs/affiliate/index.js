const query = /* GraphQL */ `
  type Affiliate {
    id: ID!
    company_name: String
    email: String
    contact_firstname: String
    contact_lastname: String
    address: String
    nationality: Countries
    billing_country: Countries
    user_id: User
    language_id: Language
    languageId: ID
    currency_id: Currency
    currencyId: ID
    contact_number: String
    asset_mgt: Boolean
    rates: Float
    markupRates: Float
    logo: String
    created_at: String
    updated_at: String
    settings: AcctSettings
    invoice_settings: InvoiceSettings
    status: String
    acct_confirmation: Boolean
  }
  type AffiliateAcct {
    id: ID
    affiliateId: ID
    billing_address: BillingAddress
    invoice_email: String
    contact_number: String
    fax_number: String
    tax_id: String
    created_at: String
    updated_at: String
  }
  type BillingAddress {
    main: String
    city: String
    state: String
    country: String
    zip: String
    hotline: String
  }
  type AcctSettings {
    acct_type: String
    credit: Float
    min_payout: Float
    vat: Boolean
    vat_amount: Float
    invoice_origin: String
    payment_type: String
  }
  type AffiliatesRate {
    text: String
    value: Float
  }
  type AffiliatesStatus {
    text: String
    value: Int
  }
  type AffiliateInvoiceSettings {
    code: String
    name: String
  }
  type InvoiceSettings {
    setting_code: String
    weekly_invoice_day: String
    monthly_invoice_date: Int
  }
  type AffiliateTypes {
    name: String
    description: String
  }

  input AffiliatesInput {
    id: String
    company_name: String
    email: String
    contact_firstname: String
    contact_lastname: String
    address: String
    nationality: Int
    billing_country: Int
    language_id: Int
    currency_id: Int
    contact_number: String
    rates: Float
    markupRates: Float
    logo: String
    status: Int
    acct_confirmation: Boolean
    settings: AcctSettingsInput
    invoice_settings: InvoiceSettingsInput
    searchTerm: String
    order: String
    limit: Int
    offset: Int
  }

  input AffiliateAcctInput {
    affiliateId: ID!
    billing_address: BillingAddressInput
    invoice_email: String
    contact_number: String
    fax_number: String
    tax_id: String
  }
  input BillingAddressInput {
    main: String
    city: String
    state: String
    country: String
    zip: String
    hotline: String
  }
  input AcctSettingsInput {
    acct_type: String
    credit: Float
    min_payout: Float
    invoicing_date: String
    vat: Boolean
    vat_amount: Float
    invoice_origin: String
    payment_type: String
  }
  input InvoiceSettingsInput {
    setting_code: String
    weekly_invoice_day: String
    monthly_invoice_date: Int
  }
`;

module.exports = [query];
