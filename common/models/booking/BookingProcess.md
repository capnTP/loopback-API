# Booking Website Steps

1. Booking is created after filling the first 2 pages which are User's personal info and then any other optional fields which are required from that subProduct. This will call `Bookng/create` and will trigger the validation in `before save` for new instances. 

2. In `before save` based on email it will either create new user or update current user's country.

3. Next step in website will allow user to change the currency they want to pay in which will be in the form of selecting `billing_country_id`. This will call `updateBookingBilling` which will update the booking price into the currency of the selected country.

** Note that booking status up until now is stll 0. No payment and charge created yet.**

4. In the website, after selecting a payment method from available ones it will call `createPayment` for that particular method.

5. Once the payment is complete, it will update the payment status. If it's a success it will follow up with updating `booking_status_id` to `1`.

6. `booking_status_id` = `1` will trigger its `after save` hook to call `Charge.createChargeFromBooking` to create charge for this booking (Repeated calls won't create additional charges) along with sending email to the customer if it wasn't already sent through other means.

## Updating booking afterwards

7. Any other changes to booking are done through `Booking.amend` while changes to charge will be from `Charge.addCharge` and `Charge.batchDelete` for creating and deleting charges. After performing any of the above changes, t will `update booking_status_id to 3`.

8. To confirm the changes, it will call `Charge.amendToSupplierConfirm` which will apply the changes or to cancel will go to `Charge.amendToSupplierCancel` which will revert the changes to both charge and booking amendment. Booking status will go back to its previos status (1 or 2)

# Booking steps for AAB (CMS and affliate)

  - CMS can save its value as draft but it won't affect anything.
  - Data will go through validation process same as website booking with few differences. Price will be accepted as is without any validation on that part. Original selling price is saved in another key inside priceDetails just for reference.
  - Charge and Payment are created inside it right away without relying on hooks.
  - Emails are also sent according to input wihtout relying on hooks

** Note: booking and payment status are based on payment type. Offline will set it to 1 (On Request) while online will be 0 (created - same as website). If it's online it will only update again after payment has been completed (same as website)

Further changes are done in the same way as normal booking with amend and charge changes.
