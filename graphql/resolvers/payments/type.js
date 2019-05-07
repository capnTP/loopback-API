module.exports = /* GraphQL */ `
  extend type Query {
    payments(booking_id: String): [Payment]
    paymentsIn(where: PaymentFilters, limit: Int, offset: Int, order: String): [Payment]!
    paymentsInCount(where: PaymentFilters): Int
    affiliatePaymentsDownload(where: PaymentFilters, limit: Int, offset: Int, order: String): DownloadData
    paymentReport(where:PaymentReportFilters): [PaymentReport]
    bookingReport(where:BookingReportFilters): [BookingReport]
    bookingReportSupplier(where: BookingReportFilters): [BookingReport]
    availablePaymentOptionsAffiliate: [AvailablePayment]
    isCompletePayment(bookingId: String, paymentMethodId: String): CheckCompletePayment
  }

  type Payment {
    id:ID
    booking_id: Booking
    created_at:String
    payment_gateway_response:String
    paymentsPaymentMethodIdFkeyrel:PaymentsPaymentMethodIdFkeyrel
    paymentsPaymentStatusIdFkeyrel:PaymentsPaymentStatusIdFkeyrel
    paymentsBookingIdFkeyrel:PaymentsBookingIdFkeyrel
    external_transaction_id:String
    external_authorize_id:String
    external_reference_id:String
    external_charge_id:String
    external_refund_id:String
    payment_status_id:String
    total:String
    total_charge:String
    total_refund:String
    final_amount: String
    currency:String
    exchange_rate:Float
    payment_type:String
    payment_method_id: Int
    payer_id: Int
    payment_method: PaymentMethod
    payment_status: PaymentStatus
  }

  type PaymentReport {
    payment_id:ID
    booking_no: String
    authorize_amount:Float
    count:Int
    final_amount: Float
    final_amount_usd: Float
    currency: String
    exchange_rate:Float
    customer_email:String
    created_at: String
    payment_update_date: String
    payment_status: String
    payment_status_id: String
    payment_method_id: Int
    payment_method: String
    payment_gateway: String
    external_reference_id: String
  }

  input PaymentReportFilters {
    limit: Int
    offset:Int
    payment_status_ids:[String]
    currencies:[Int]
    payment_method_ids: [Int]
    booking_ids:[Int]
    user_ids:[Int]
    created_at: DateFilter
  }

   type BookingReport {
    bid:ID
    payout_id:Int
    trip_date:String
    created_at: String
    booking_no: String
    booking_type:String
    booking_gateway:String
    product:String
    sub_product:String
    city:String
    country:String
    supplier:String
    customer_name:String
    customer_nationality: String
    adult_pax: Int
    child_pax: Int
    selling_price: Float
    supplier_price:Float
    local_price: Float
    local_price_currency: String
    booking_status: String
    updated_at: String
    count:Int
  }

  input BookingReportFilters {
    limit: Int
    offset:Int
    tour_ids:[Int]
    user_ids:[Int]
    trip_date: DateFilter
    supplier_ids: [Int]
    booking_status_ids:[Int]
    created_at: DateFilter
    booking_ids: [Int]
  }


  type PaymentMethod {
    id:ID
    name: String
    status: Boolean
  }

  type PaymentStatus {
    id:ID
    status: String
    affiliate_name: String
  }

  input DateFilter {
    to:String
    from:String
  }

  input PaymentFilters {
    searchTerm: String
    id:ID
    created_at:String
    booking_id: Int
    external_transaction_id:Int
    external_authorize_id:String
    external_reference_id:String
    external_charge_id:Int
    external_refund_id:Int
    payer_id: Int
    payment_status:[String]
    payment_method_id:Int
    total:Float
    total_charge:Float
    total_refund:Float
    currency:String
    payment_type:String
    fromDate: String
    toDate: String
  }

  type PaymentsPaymentMethodIdFkeyrel {
    id:ID
    name:String
  }

  type PaymentsPaymentStatusIdFkeyrel {
    id:ID
    status:String
  }

  type PaymentsBookingIdFkeyrel {
    id: ID
    billing_first_name: String
    billing_last_name: String
  }

  type AvailablePayment {
    id: ID
    name: String
    icon: String
    type: Int
    currencies: [String]
  }

  type CheckCompletePayment {
    status: Int
  }
`;
