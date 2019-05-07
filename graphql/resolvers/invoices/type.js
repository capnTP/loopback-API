module.exports = /* GraphQL */ `
  extend type Query {
		invoice(id: ID!): Invoice
		invoices(where: InvoiceFilters): [Invoice]
    invoicesCount(where: InvoiceFilters): Int
	}
	
	extend type Mutation {
    editInvoiceItems(input: InvoiceInput): ItemsEditResponse
    editInvoiceCharges(input: InvoiceInput): InvoiceUpdateResponse
    updateInvoiceStatus(input: InvoiceInput):  InvoiceUpdateResponse
	}

  type Invoice {
    id: ID
		payer_id: String
		receiver_id: String
		comments: String
		details: [Booking]
		amount: Float
		currency_code: String
		status: String
		payment_type: String
		created_at: String
    transaction_date: String
    surcharge: [ExtraCharges]
	}

	type ItemsEditResponse {
		id: ID
    status: Boolean
    message: String
		itemsAdded: [String]
		itemsRemoved: [String]
  }

  type InvoiceUpdateResponse {
    id: ID
    status: Boolean
    message: String
  }

  type ExtraCharges {
    title: String
    amount: Float
  }

	input InvoiceFilters {
    searchTerm: String
		currency_code: String
    transaction_date: String
    created_at: InvoiceDateFilter
    payment_type: String
    status: [String]
    amount: Float
    limit: Int
    offset:Int
    payment_method_id: Int
    receiver_id: Int
    payer_id: [Int]
	}

	input InvoiceDateFilter {
    to:String
    from:String
  }
  
  input InvoiceCharges {
    title: String
    amount: Float
  }
	
	input InvoiceInput {
		id: ID
		details: [String]
    comments: String
    status: String
    transaction_date: String
    surcharge: [InvoiceCharges]
  }
`;
