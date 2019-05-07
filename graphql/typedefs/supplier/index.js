const query = /* GraphQL */ `
  type Supplier {
    id: ID!
    company_name: String
    reservation_email: String
    name: String
    country: Countries
    country_id: Int
    currency: Currency
    currency_id: Int
    public_phone_number: String
    address: String
    secondary_email: String
    business_phone_number: String
    fax: String
    status: String
    logo: String
    created_at: String
    updated_at: String
    settings: SupplierAcctSettings
  }
  type SuppliersBillingAccount {
    id: ID
    supplier_id: ID
    billing_address: SupplierBillingAddress
    invoice_email: String
    contact_number: String
    fax_number: String
    tax_id: String
    created_at: String
    updated_at: String
  }

  type SuppliersPaymentAccount {
    id:ID
    supplier_id:ID
    details: SupplierPaymentAccountDetails
    is_default: Boolean
    status: Boolean
    payment_method_id: ID
  }

  type SupplierPaymentAccountDetails {
    account_name: String
    bank_name: String
    ifsc_code: String
    account_number: String
  }

  input SuppliersPaymentAccountInput {
    supplier_id: ID
    details: SupplierPaymentAccountDetailsInput
    is_default: Boolean
    status: Boolean
    payment_method_id: ID
  }

  input SupplierPaymentAccountDetailsInput {
    account_name: String
    bank_name: String
    ifsc_code: String
    account_number: String
  }

  type SupplierBillingAddress {
    main: String
    city: String
    state: String
    country: String
    zip: String
  }
  type SupplierAcctSettings {
    setting_code: String
    weekly_payout_day:String
    monthly_payout_date:Int
    vat: Float
  }

  input SuppliersInput {
    id: String
    company_name: String
    reservation_email: String
    name: String
    address: String
    country_id: Int
    currency_id: Int
    public_phone_number: String
    business_phone_number: String
    fax: String
    status: String
    logo: String
    created_at: String
    updated_at: String
    settings: SupplierAcctSettingsInput
    searchTerm: String
    order: String
  }

  input SuppliersBillingAccountInput {
    supplier_id: ID!
    billing_address: SupplierBillingAddressInput
    invoice_email: String
    contact_number: String
    fax_number: String
    tax_id: String
  }
  input SupplierBillingAddressInput {
    main: String!
    city: String!
    state: String!
    country: String!
    zip: String!
  }
  input SupplierAcctSettingsInput {
    setting_code: String
    weekly_payout_day:String
    monthly_payout_date:Int
    vat: Float
  }
`;

module.exports = [query];
