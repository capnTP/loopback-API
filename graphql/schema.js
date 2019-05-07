const path = require('path');

const { makeExecutableSchema } = require('graphql-tools');
const glob = require('glob');

const resolvers = require('./resolvers');
const GraphQlDefinition = require('./resolvers/GraphQlDefinition');
const common = require('./typedefs/common');
const user = require('./typedefs/user');
const subProduct = require('./typedefs/subProduct');
const language = require('./typedefs/language');
const globalConfig = require('./typedefs/globalConfig');
const topSearches = require('./typedefs/topSearches');
const charge = require('./typedefs/charge');
const affiliate = require('./typedefs/affiliate');
const supplier = require('./typedefs/supplier');
const draft = require('./typedefs/draft');

const definitions = glob.sync('./graphql/resolvers/**/*.js').reduce((acc, file) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const target = require(path.resolve(file));
    /** Strictly check for a partic ular type to prevent missing required key */
    if (!(target instanceof GraphQlDefinition)) {
      return acc;
    }
    acc.push(target);
    return acc;
  } catch (e) {
    return acc;
  }
}, []);

module.exports = makeExecutableSchema(
  definitions.reduce(
    (acc, def) => {
      if (def.type) {
        acc.typeDefs.push(def.type);
      }

      if (def.query) {
        acc.resolvers.Query = Object.assign(acc.resolvers.Query, def.query);
      }

      if (def.mutation) {
        acc.resolvers.Mutation = Object.assign(acc.resolvers.Mutation, def.mutation);
      }

      if (def.resolver) {
        acc.resolvers = Object.assign(acc.resolvers, def.resolver);
      }

      return acc;
    },
    {
      typeDefs: [
        /* GraphQL */ `
          type Query {
            affiliate(id: ID): Affiliate
            activities(model_name: String, model_id: String): [ActivityLog]
            affiliates(input: AffiliatesInput): [Affiliate]
            affiliatesCount(input: AffiliatesInput): Int
            affiliatesRates: [AffiliatesRate]
            affiliatesStatuses: [AffiliatesStatus]
            affiliateAcct(affiliate_id: ID): AffiliateAcct
            affiliateInvoiceSettings: [AffiliateInvoiceSettings]
            affiliateTypes: [AffiliateTypes]
            booking(id: ID, supplier_id: ID): Bookings
            bookingAffiliate(id: ID!): Booking
            bookingSupplier(id: ID!, supplier_id: ID!): Booking
            bookings(input: BookingsInput): [Booking]
            bookingsAffiliate(input: BookingsAffiliateInput): BookingsAffiliateRes
            bookingsSupplier(input: BookingsSupplierInput): BookingsAffiliateRes
            bookingsCount(input: BookingsInput): Int
            bookingEmailLang: [BookingEmailLangType]
            bookingEmails: [BookingEmail]
            bookingEmailsAffiliate: [BookingEmail]
            bookingListByUserId(user_id: ID, nin_booking_id: ID): [Bookings]
            bookingStatusList: [BookingStatus]
            bookingMethods(active: Boolean): [BookingMethod]
            cancellationPolicies: [CancellationPolicy]
            categoryTypes: [CategoryType]
            categories: [Category]
            chargeTypes: [ChargeType]
            contractLogos: [ContractLogo]
            convertCp: String
            currencies: [Currency]

            draft(id: ID!): Draft
            drafts(input: BookingsInput): [Draft]
            draftsCount: Count

            getEmailTypes: [String]
            getChargeByBookingId(booking_id: ID): [Charge]
            getActivityLog(
              model_name: String
              model_id: String
              limit: ID
              offset: ID
              order: String
            ): [ActivityLog]
            getActivityLogCount(model_name: String, model_id: String): Success
            getSubProductById(id: ID, lang: String): SubProductOP
            getLanguageCode(code: String): langCodeOP
            getUser: User
            getUserByToken(token: String!): User
            globalConfigs: [GlobalConfig]
            globalConfig(input: GlobalConfigInput): GlobalConfig

            includeExcludeList: [IncludeExclude]

            languageList(available: Boolean): [Language]!

            newsletters: [NewsLettersSubscriptions]

            profile: Profile

            roles: [Role]

            searchUsers(text: String): [User]
            supplier(id: ID): Supplier
            suppliers(input: SuppliersInput): [Supplier]
            suppliersCurrencies: [Currency]
            supplierBillingAccounts(supplier_id: ID): SuppliersBillingAccount
            SuppliersPaymentAccounts(supplier_id: ID): SuppliersPaymentAccount
            subProduct(id: ID, languageCode: String): SubProductOP

            topsearches: [TopSearches]
            topsearch(input: TopSearchInput): TopSearches

            user(id: ID!): User
            users: [User]!
            userCards: [TokenizedCardData]
          }

          type Mutation {
            aabBooking(
              input: DraftInput
              affiliateTemplate: String
              customerTemplate: String
              supplierTemplate: String
              paymentType: String
            ): Booking
            addCharge(
              input: ChargeInput
              isSendCustomerEmail: Boolean
              isSendSupplierEmail: Boolean
            ): String
            addTopSearch(id: ID, lang: String, keyword: String, url: String): TopSearches
            addDraft(input: DraftInput): Draft
            addSubProduct(input: SubProductInput): SubProductOP
            addConfig(key: String, value: String, enable: Boolean): GlobalConfig
            addAffiliate(input: AffiliatesInput): Affiliate
            addAffiliateAcct(input: AffiliateAcctInput): AffiliateAcct
            addSupplier(input: SuppliersInput): Supplier
            addSupplierPaymentAccount(input: SuppliersPaymentAccountInput): SuppliersPaymentAccount
            addCompany(input: CompanyInput): Company
            addSupplierBilling(input: SuppliersBillingAccountInput): SuppliersBillingAccount
            amendBooking(
              id: ID
              update: BookingInput
              isSendCustomerEmail: Boolean
              isSendSupplierEmail: Boolean
            ): Bookings

            bookingListByStatusId(
              booking_status_id: String
              tour_id: String
              order: String
              offset: String
              limit: String
            ): [Bookings]
            bookingStatusCount(booking_status_id: String): Count
            bookingUpdate(input: Checkout): Bookings

            convertAsciiToBase64(text: String): String
            convertBase64ToAscii(text: String): String
            cancelBookingRefund(
              booking_id: ID
              refundOption: String
              isSendCustomerEmail: Boolean
              isSendSupplierEmail: Boolean
              cancellationCost: String
              supplierCancellationCost: String
            ): RefundOP

            deleteAffiliate(id: ID!): Success
            deleteChargeBatch(
              list: [ID]
              isSendCustomerEmail: Boolean
              isSendSupplierEmail: Boolean
            ): String
            deleteDraft(id: ID!): Success
            deleteIncludeExclude(id: ID!): Success
            deleteMedia(id: ID!): Success
            deleteReview(id: ID!): Success
            deleteSupplier(id: ID!): Success
            deleteSubProduct(id: ID!): Success
            deleteConfig(id: ID!): Success
            deleteUserCard(id: ID!): Success
            downloadBookingsAffiliate(input: BookingsAffiliateInput): DownloadData
            downloadBookingsSupplier(input: BookingsSupplierInput): DownloadData
            duplicateSubProduct(id: ID!, name: String): SubProductOP

            enterIncludeExclude(input: ProductExcludeIncludeInput!): Success
            enterProduct(input: ProductInput!, lang: ID): Product

            getBookingStatus(
              booking_id: ID
              booking_status_id: ID
              isApprove: Boolean
              isSendCustomerEmail: Boolean
              isSendSupplierEmail: Boolean
            ): Status
            getCalcellationPolicyById(id: ID): CountryById
            getEmailTemplate(
              lang_id: ID
              booking_id_id: ID
              email_template_type: String
            ): EmailPreview
            getEmailTemplateAffiliate(
              lang_id: ID
              booking_id_id: ID
              email_template_type: String
            ): EmailPreview
            getUserInfo(id: ID): User

            loginUser(input: Login!): LoginSuccess
            loginAffiliate(input: Login!): LoginSuccess
            loginSupplier(input: Login!): LoginSuccess
            logoutUser(accessToken: String!): String

            registerUser(input: Register!): RegisterSuccess
            replaceExcludedIncluded(tourId: ID, input: [ProductExcludeIncludeInput]): Success

            saveUserDetails(input: UpdateUser): UpdateUserOP
            saveUserCardData(access_token: String!, input: CardData!): TokenizedCardData
            sendManualMail(
              to: String
              from: String
              subject: String
              html: String
              attachments: String
              booking_id: ID
            ): TemplateString
            sendTransEmail(
              to: String
              from: String
              subject: String
              lang_id: ID
              booking_id: ID
              email_template_type: String
            ): TemplateString
            setAccessToken(input: AccessToken!): AccessTokenSuccess
            updateUserCard(id: ID, input: CardData!): TokenizedCardData
            updateAffiliate(id: ID, input: AffiliatesInput): Affiliate
            updateAffiliateAcct(input: AffiliateAcctInput): AffiliateAcct
            updateAffiliateCompany(account: AffiliatesInput, company: AffiliateAcctInput): Affiliate
            updateAffiliateBooking(id: ID, params: UpdateAffiliateBookingInput): Booking
            updateSupplier(id: ID, input: SuppliersInput): Supplier
            updateSupplierPaymentAccount(
              input: SuppliersPaymentAccountInput
            ): SuppliersPaymentAccount
            makeDefaultSupplierPaymentAccount(supplier_id: ID, account_id: ID): Boolean
            updateCompany(id: ID, input: CompanyInput): Company

            updateBooking(id: ID, update: BookingInput): Booking
            updateSupplierBooking(input: BookingSupplierInput): Booking
            updateTopSearch(query: TopSearchInput, update: TopSearchInput): TopSearches
            updateTopSearchById(input: TopSearchInput): TopSearches
            updateConfig(id: ID, key: String, value: String, enable: Boolean): GlobalConfig
            updateDraft(id: ID!, input: DraftInput): Draft
            updatePassword(password: String!, access_token: String!): Boolean
            updateSubProduct(
              id: ID!
              input: SubProductInput!
              languageCode: String
              deleteCalendarPrice: Boolean
            ): SubProductOP
            updateSubproductById(input: SubProductInput): SubProductOP
            updateSubProductPricing(id: ID!, input: SubProductPricingInput!): SubProductPricing
          }

          schema {
            query: Query
            mutation: Mutation
          }
        `,
      ].concat(
        common,
        user,
        subProduct,
        language,
        globalConfig,
        topSearches,
        charge,
        affiliate,
        supplier,
        draft,
      ),
      resolvers,
    },
  ),
);
