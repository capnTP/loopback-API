/* eslint-disable no-unsafe-finally */
const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const pug = require('pug');
const QRCode = require('qrcode');
const moment = require('moment');
const request = require('request');
const axios = require('axios');
const i18n = require('i18n');
const _ = require('lodash');

const { s3 } = require('../../helpers/aws');
const hostConfig = require('../../../server/config/config.json');
const {
  newLoopbackError,
  HTTPStatusCode: { FORBIDDEN, BAD_REQUEST },
  constants: { isProduction },
  getSafe,
} = require('../../utility');

const SLACK_URLS = {
  production: 'https://hooks.slack.com/services/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',
  development: 'https://hooks.slack.com/services/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',
  local: process.env.SLACK_ERROR_URL,
  test: process.env.SLACK_ERROR_URL,
};

const SLACK_URL = SLACK_URLS[process.env.NODE_ENV] || SLACK_URLS.development;

let folderBucket;
let configHost;
if (process.env.NODE_ENV == 'production') {
  folderBucket = 'theasia-cloud';
  configHost = hostConfig.production;
} else {
  folderBucket = 'theasia-cloud/sandbox';
  configHost = hostConfig.development;
}

module.exports = Voucher => {
  const sendErrorToSlack = (errorObj, booking_id) => {
    const objectStatus = {
      error: errorObj.message,
      message: errorObj.origin.message,
      status: errorObj.status,
      status_code: errorObj.origin.code,
    };

    const payload = {
      text: `*:label:You have a PDF Error*:scroll:\n
      *Booking_id*: ${booking_id}\n
      *Check here*: <${configHost.admin_url}booking-details/${booking_id}|Click here> for details\n
      *Status* : \`\`\`${JSON.stringify(objectStatus.status)}\`\`\`
      *Errors* : \`\`\`${JSON.stringify(objectStatus.error)}: ${objectStatus.message}\`\`\`
      *Status Code* : \`\`\`${JSON.stringify(objectStatus.status_code)}\`\`\``,
      username: 'Payment Bot',
      icon_emoji: ':page_with_curl:',
    };
    const options = {
      url: SLACK_URL,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };

    request.post(options);
  };

  const configure_i18n = (directory, lang_code) => {
    i18n.configure({
      locales: [lang_code],
      directory,
    });
    i18n.setLocale(lang_code);
  };

  Voucher.getBookingTest = async booking_id => {
    const Booking = Voucher.app.models.Booking;

    if (!booking_id) return Promise.reject('No booking id dat');

    try {
      // const bookingData = await Booking.findById(booking_id, Booking.defaultFilter)
      const responseData = await Voucher.createVoucherFileData(booking_id);
      return Promise.resolve(responseData);
    } catch (err) {
      // push log
      // pushLogData(`${configHost.api_url}/PaymentLogs/`, 'PAYMENT_LOG', 'GET', 4, `pid: ${data.pid}`, err, 'PAYPAL', 500)
      // sendErrorToSlack(err, data.bid)
      return Promise.reject(err);
    }
  };
  Voucher.remoteMethod('getBookingTest', {
    accepts: [
      {
        arg: 'booking_id',
        type: 'string',
        description: 'requied booking_id',
        required: true,
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/getBookingTest', verb: 'post' },
  });

  Voucher.getVoucher = async data => {
    const Booking = Voucher.app.models.Booking;

    if (!data.bid) return Promise.reject('No booking id dat');

    try {
      const bookingData = await Booking.findById(data.bid);
      const params = {
        Bucket: folderBucket,
        Key: `pdf/voucher_${bookingData.booking_no}.pdf`,
        Expires: 24000, // expire url in 10 minute -> 600 sec
      };
      // const responseFromS3 = await s3.getObject(params).promise()
      const responseFromS3 = await s3.getSignedUrl('getObject', params);
      return Promise.resolve(responseFromS3);
    } catch (err) {
      // push log
      // pushLogData(`${configHost.api_url}/PaymentLogs/`, 'PAYMENT_LOG', 'GET', 4, `pid: ${data.pid}`, err, 'PAYPAL', 500)
      // sendErrorToSlack(err, data.bid)
      return Promise.reject(err);
    }
  };

  /**
   * removeVoucher function - only calla from booking model for sure
   * @param {*} booking_id
   */
  Voucher.removeVoucher = async booking_id => {
    const Booking = Voucher.app.models.Booking;

    if (!booking_id) return Promise.reject('No booking id data');

    let responseObject;
    try {
      const bookingData = await Booking.findById(booking_id);
      const params = {
        Bucket: folderBucket,
        Key: `pdf/voucher_${bookingData.booking_no}.pdf`,
      };
      const responseFromS3 = await s3.deleteObject(params).promise();
      responseObject = { status: 1000, message: 'success pdf deleted' };
      return Promise.resolve(responseObject);
    } catch (e) {
      responseObject = { status: 5000, message: 'remove file in s3 failed', origin: e };
      sendErrorToSlack(responseObject, booking_id);
    } finally {
      return Promise.resolve(responseObject);
    }
  };

  // count row that maybe use in create pdf data
  function countRowCharacter(textToCount) {
    let row = 0;
    let carry = 0;
    const maxAlPerRow = 21;
    const stringSplitArray = textToCount.split(' ');
    for (let i = 0; i < stringSplitArray.length; i++) {
      let lengthToCheck = stringSplitArray[i].length;
      if (carry > 0) {
        lengthToCheck += carry;
        carry = 0;
      }

      if (lengthToCheck + 1 > 21) {
        row += 1;
        carry = stringSplitArray[i].length - 21;
      } else if (i <= stringSplitArray.length - 1) {
        let subLengthToCheck = lengthToCheck;
        for (let j = i + 1; j < stringSplitArray.length; j++) {
          if (subLengthToCheck + stringSplitArray[j].length >= 21) {
            row += 1;
            if (subLengthToCheck + stringSplitArray[j].length == 21) {
              i = j;
            } else {
              i = j - 1;
            }
            lengthToCheck = 0;
            carry = 0;
            break;
            // carry += subLengthToCheck - 21
          } else if (lengthToCheck + stringSplitArray[j].length + 1 < 21) {
            subLengthToCheck += stringSplitArray[j].length + 1;
          }
        }
      }

      // last case if carray more than 21 or equal we will count 1 row
      if (carry >= 21) {
        row += 1;
        carry -= 21;
      }
    }
    if (row == 0) {
      row += 1;
    }

    return row;
  }

  /**
   * createVoucherFileData function - only calla from booking model(getVoucherAttachments) and createPdfToS3 for sure
   * @param {*} booking_id
   */
  Voucher.createVoucherFileData = async booking_id => {
    const Booking = Voucher.app.models.Booking;
    const Languages = Voucher.app.models.Languages;
    const CancellationPolicies = Voucher.app.models.CancellationPolicies;
    const ralewayRegular = 'misc/fonts/Raleway-Regular.ttf';
    const ralewayMedium = 'misc/fonts/Raleway-Medium.ttf';
    const ralewayBold = 'misc/fonts/Raleway-Bold.ttf';
    // let booking_id = data.booking_id
    if (!booking_id) return Promise.reject('No booking id data');
    try {
      /*
       *
       * this section is config of pdf data
       * font size and everything
       */
      const beforeHeaderFontSize = 15; // grey text booking voucher no
      const mainHeaderFontSize = 18; // green biggest text in top
      const subproductNameFontSize = 13; // black text bottom green in top section
      const dataFontSize = 11; // booking data in pdf (black text)
      const topicFontsize = 9; // booking topic data in pdf (grey text)
      const paddingBetweenSection = 10;
      const paddingheader = 6;
      const paddingBetweenRowSize = 4;
      const startXPosition = 35; // left margin for every data after header
      // color scheme
      const TheAsiaGreen = '#4CAC87';
      const charcoalBlack = '#363436';
      const MediumGray = '#847E7F';
      const LightGray = '#DCD9D9';
      /*
       * end config pdf
      */
      let bookingData = await Booking.findById(booking_id, Booking.defaultFilter);
      bookingData = bookingData.toObject();
      const isAffiliate = Number(bookingData.booking_method_id) === 3;
      const featureData = await Voucher.app.models.Features.find();

      const doc = new PDFDocument({
        size: [595, 842],
        margins: {
          top: 27,
          bottom: 25,
          left: 15,
          right: 30,
        },
        layout: 'portrait',
        info: {
          Title: 'Voucher',
          Author: 'TheAsia',
          Subject: 'E-Voucher',
          Keywords: 'TheAsia',
        },
      });

      const filePath = path.join(
        __dirname,
        `../../../downloads/vouchers/voucher_${bookingData.booking_no}_${moment().unix()}.pdf`,
      );
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      doc.fontSize(10);
      doc.font(ralewayRegular);
      // Template and background and pic
      if (isAffiliate && getSafe(() => bookingData.bookingUserIdFkeyrel.affiliates.logo)) {
        const url = `https://theasia.imgix.net/${
          bookingData.bookingUserIdFkeyrel.affiliates.logo
        }?fit=crop&w=200&h=100`;
        const imageRes = await axios.get(url, { responseType: 'arraybuffer' });
        const imageBase64 = Buffer.from(imageRes.data).toString('base64');
        const imageData = `data:${imageRes.headers['content-type']};base64,${imageBase64}`;
        doc.image(imageData, 30, 50, { fit: [200, 200] });
      } else {
        doc.image('./common/models/voucher/images/header.png', 0, 0, { fit: [250, 250] });
      }

      // This section is header section in pdf
      doc.font(ralewayBold);
      doc
        .fill(MediumGray)
        .fontSize(beforeHeaderFontSize)
        .stroke()
        .text(`Booking Voucher No. #${bookingData.booking_no}`, 250, 40);

      doc
        .fill(TheAsiaGreen)
        .fontSize(mainHeaderFontSize)
        .stroke()
        .text(getSafe(() => bookingData.tour.name), 250, 80);
      if (getSafe(() => bookingData.tour.name) != getSafe(() => bookingData.sub_product.name)) {
        doc
          .fill(charcoalBlack)
          .fontSize(subproductNameFontSize)
          .stroke()
          .text(getSafe(() => bookingData.sub_product.name) || '', 250, 175);
      }
      doc
        .moveTo(130, 236)
        .fontSize(10)
        .lineTo(595, 236)
        .fill('#00ce87')
        .stroke();

      // This section for text data in pdf
      const headerTextArray = [];
      const dataTextArray = [];
      // Guest Name
      if (getSafe(() => bookingData.billing_first_name) || '') {
        headerTextArray.push('Guest Name');
        dataTextArray.push(`${bookingData.billing_first_name} ${bookingData.billing_last_name}`);
      }
      // No. of guest
      switch (getSafe(() => bookingData.tour.product_type)) {
        case 1:
          if (getSafe(() => bookingData.input_details.adult_pax) || '') {
            headerTextArray.push('No. of guest');
            const sum_pax =
              parseInt(bookingData.input_details.adult_pax, 10) +
              parseInt(bookingData.input_details.child_pax, 10);
            let tempString = `${sum_pax} (${bookingData.input_details.adult_pax} adults`;
            if (bookingData.input_details.child_pax > 0) {
              tempString += `/${bookingData.input_details.child_pax} children`;
            }
            tempString += ')';
            dataTextArray.push(tempString);
          }
          break;
        case 2: // transportration
          headerTextArray.push('No. of Vehicle');
          dataTextArray.push(`${bookingData.input_details.adult_pax}`);
          break;
        case 3: // Luggage
          headerTextArray.push('No. of Luggage');
          dataTextArray.push(`${bookingData.input_details.adult_pax}`);
          break;
        case 4: // SIM
          headerTextArray.push('No. of SIM');
          dataTextArray.push(`${bookingData.input_details.adult_pax}`);
          break;
        default:
      }

      // Selected date
      if (getSafe(() => bookingData.trip_starts) || '') {
        headerTextArray.push('Selected date');
        dataTextArray.push(`${new Date(bookingData.trip_starts).toDateString()}`);
      }

      // ***** this will update again after ask p b team ****
      // Departure, Location, Duration
      // if (getSafe(() => bookingData.tour.features[0].feature.name) || '') {
      //   const feature = bookingData.tour.features[0].feature.name
      //
      //   if ((feature == 'Joint Tour') || (feature == 'Private Tour')) {
      //     headerTextArray.push('Departure')
      //     dataTextArray.push(bookingData.sub_product.departure)
      //   } else {
      //     headerTextArray.push('Location')
      //     dataTextArray.push(bookingData.sub_product.location)
      //   }
      //   if ((feature == 'Joint Tour') || (feature == 'Private Tour') || (feature == 'Dinner Cruise') || (feature == 'Show')) {
      //     headerTextArray.push('Duration')
      //     dataTextArray.push(bookingData.sub_product.tour_duration)
      //   }
      // }

      if (getSafe(() => bookingData.sub_product.departure) || '') {
        headerTextArray.push('Departure');
        dataTextArray.push(bookingData.sub_product.departure);
      } else if (getSafe(() => bookingData.tour.departure) || '') {
        headerTextArray.push('Departure');
        dataTextArray.push(bookingData.tour.departure);
      }

      if (getSafe(() => bookingData.sub_product.location) || '') {
        headerTextArray.push('Location');
        dataTextArray.push(bookingData.sub_product.location);
      } else if (getSafe(() => bookingData.tour.location) || '') {
        headerTextArray.push('Location');
        dataTextArray.push(bookingData.tour.location);
      }

      if (getSafe(() => bookingData.sub_product.tour_duration) || '') {
        headerTextArray.push('Duration');
        dataTextArray.push(bookingData.sub_product.tour_duration);
      } else if (getSafe(() => bookingData.tour.tour_duration) || '') {
        headerTextArray.push('Duration');
        dataTextArray.push(bookingData.tour.tour_duration);
      }

      if (getSafe(() => bookingData.drop_off_place) || '') {
        headerTextArray.push('Drop off place');
        dataTextArray.push(bookingData.drop_off_place);
      }

      if (getSafe(() => bookingData.hotel_name) || '') {
        headerTextArray.push('Hotel Name');
        dataTextArray.push(bookingData.hotel_name);
      }

      // Product Type
      if (getSafe(() => bookingData.sub_product.product_features) || '') {
        headerTextArray.push('Product Type');
        const subProductFeatures = JSON.parse(bookingData.sub_product.product_features);
        const found = featureData.find(
          element => element.id === parseInt(subProductFeatures[0], 10),
        );
        dataTextArray.push(getSafe(() => found.name) || '');
      } else if (getSafe(() => bookingData.tour.features[0].feature.name) || '') {
        headerTextArray.push('Product Type');
        dataTextArray.push(bookingData.tour.features[0].feature.name);
      }

      // Pick up place
      if (getSafe(() => bookingData.pickup_place) || '') {
        headerTextArray.push('Pick up place');
        dataTextArray.push(bookingData.pickup_place);
      }

      // Pick up time
      if (getSafe(() => bookingData.pickup_time) || '') {
        headerTextArray.push('Pick up time');
        dataTextArray.push(bookingData.pickup_time);
      }

      // Pickup location and time
      // this change for prevent null and blank data but right now pickup_location_time is still update in tours not in sub_product
      if (getSafe(() => bookingData.pickup_location_time)) {
        headerTextArray.push('Pick up time and location');
        dataTextArray.push(`${bookingData.pickup_location_time}`);
      }

      if (getSafe(() => bookingData.selected_time)) {
        headerTextArray.push('Selected time');
        dataTextArray.push(`${bookingData.selected_time}`);
      }

      // we will show this section when two of this section have blank
      if (
        getSafe(() => bookingData.pickup_place) == '' ||
        getSafe(() => bookingData.pickup_time) == ''
      ) {
        // Meeting Point
        if (getSafe(() => bookingData.meeting_point) || '') {
          headerTextArray.push('Meeting Point');
          dataTextArray.push(bookingData.meeting_point);
        } else if (getSafe(() => bookingData.sub_product.meeting_point) || '') {
          headerTextArray.push('Meeting Point');
          dataTextArray.push(bookingData.sub_product.meeting_point);
        } else if (getSafe(() => bookingData.tour.meeting_point) || '') {
          headerTextArray.push('Meeting Point');
          dataTextArray.push(bookingData.tour.meeting_point);
        }

        // Meeting Time
        if (getSafe(() => bookingData.meeting_time) || '') {
          headerTextArray.push('Meeting Time');
          dataTextArray.push(bookingData.meeting_time);
        } else if (getSafe(() => bookingData.sub_product.meeting_time) || '') {
          headerTextArray.push('Meeting Time');
          dataTextArray.push(bookingData.sub_product.meeting_time);
        } else if (getSafe(() => bookingData.tour.meeting_time) || '') {
          headerTextArray.push('Meeting Time');
          dataTextArray.push(bookingData.tour.meeting_time);
        }
      }

      // Flight Number
      if (getSafe(() => bookingData.flight_number) || '') {
        headerTextArray.push('Flight Number');
        dataTextArray.push(bookingData.flight_number);
      }

      if (getSafe(() => bookingData.sub_product.opening_time) || '') {
        headerTextArray.push('Opening time');
        dataTextArray.push(bookingData.sub_product.opening_time);
      } else if (getSafe(() => bookingData.tour.opening_time) || '') {
        headerTextArray.push('Opening time');
        dataTextArray.push(bookingData.tour.opening_time);
      }

      if (getSafe(() => bookingData.sub_product.show_time) || '') {
        headerTextArray.push('Show time');
        dataTextArray.push(bookingData.sub_product.show_time);
      } else if (getSafe(() => bookingData.tour.show_time) || '') {
        headerTextArray.push('Show time');
        dataTextArray.push(bookingData.tour.show_time);
      }

      // Special Request
      if (getSafe(() => bookingData.special_request) || '') {
        headerTextArray.push('Special Request');
        dataTextArray.push(bookingData.special_request);
      }

      // Promotion Code
      if (getSafe(() => bookingData.promocode) || '') {
        headerTextArray.push('Promotion Code');
        dataTextArray.push(bookingData.promocode);
      }

      // Exclude Include
      if (getSafe(() => bookingData.tour.excluded_included).length != 0) {
        const ex_included_list = getSafe(() => bookingData.tour.excluded_included);
        let include_list_name = '';
        let exclude_list_name = '';
        ex_included_list.forEach(element => {
          if (element.type) {
            if (include_list_name != '') include_list_name = `${include_list_name}, `;
            include_list_name = `${include_list_name}${element.exclude_include.name}`;
          } else {
            if (exclude_list_name != '') exclude_list_name = `${exclude_list_name}, `;
            exclude_list_name = `${exclude_list_name}${element.exclude_include.name}`;
          }
        });
        if (include_list_name != '') {
          headerTextArray.push('Included');
          dataTextArray.push(include_list_name);
        }
        if (exclude_list_name != '') {
          headerTextArray.push('Excluded');
          dataTextArray.push(exclude_list_name);
        }
      }
      // sub_product address
      if (getSafe(() => bookingData.sub_product.address) || '') {
        headerTextArray.push('Address');
        dataTextArray.push(bookingData.sub_product.address);
      }

      // Contact detail address
      if (getSafe(() => bookingData.tour.suppliers.address) || '') {
        headerTextArray.push('Contact detail address');
        dataTextArray.push(bookingData.tour.suppliers.address);
      }

      // Contact detail Tel.
      if (getSafe(() => bookingData.tour.suppliers.public_phone_number) || '') {
        headerTextArray.push('Contact detail Tel');
        dataTextArray.push(
          `${bookingData.tour.suppliers.public_phone_number}\n${
            bookingData.tour.suppliers.business_phone_number
          }`,
        );
      }

      let positionX = startXPosition;
      let positionY = 255;
      let highestRow = 1;
      let nowColumn = 1;
      for (let i = 0; i < headerTextArray.length; i++) {
        if (nowColumn > 4) {
          positionX = startXPosition;
          // newPosition = oldPosition + (highestRowCounted * dataFontSize) + (paddingBetweenRow * paddingBetweenRowSize) + topicFontsize + paddingheader + paddingBetweenSection + marginHrLine
          positionY =
            positionY +
            highestRow * dataFontSize +
            (highestRow - 1) * paddingBetweenRowSize +
            topicFontsize +
            paddingheader +
            paddingBetweenSection +
            5;
          doc
            .moveTo(startXPosition, positionY)
            .fontSize(10)
            .lineTo(565, positionY)
            .dash(1, { space: 0 })
            .fill(LightGray);
          positionY += 10; // marginHrLine + hrLineSize + marginHrLineBottom
          nowColumn = 1;
          highestRow = 1;
        }
        if (nowColumn < 5) {
          if (getSafe(() => dataTextArray[i]) || '') {
            const tempRowCount = countRowCharacter(dataTextArray[i]);
            if (tempRowCount > highestRow) {
              highestRow = tempRowCount;
            }
            doc
              .font(ralewayRegular)
              .fill(MediumGray)
              .fontSize(topicFontsize)
              .text(headerTextArray[i], positionX, positionY);
            doc
              .font(ralewayBold)
              .fill(charcoalBlack)
              .fontSize(dataFontSize)
              .text(dataTextArray[i], positionX, positionY + topicFontsize + paddingheader, {
                width: 130,
              });
            positionX += 133;
            nowColumn += 1;
          }
        }
      }

      if (!isAffiliate) {
        // Footer section
        doc
          .moveTo(0, 755)
          .fontSize(10)
          .lineTo(595, 755)
          .dash(1, { space: 0 })
          .fill(LightGray);
        doc.image('./common/models/voucher/images/footer.png', 30, 780, { fit: [320, 320] });
        doc.image('./common/models/voucher/images/stamp.jpg', 450, 770, { fit: [120, 120] });
      }
      // This is Footer text section
      // cancellationPolicies
      const cancellationPoliciesData = await CancellationPolicies.findById(
        bookingData.cancellation_policy_id,
      );
      if (getSafe(() => cancellationPoliciesData.description) || '') {
        doc
          .font(ralewayRegular)
          .fill(charcoalBlack)
          .fontSize(8)
          .text('Cancellation policy :', 40, 770);
        doc
          .font(ralewayBold)
          .fill(charcoalBlack)
          .fontSize(8)
          .text(cancellationPoliciesData.description, 115, 770, { width: 300 });
      }

      if (!isAffiliate) {
        // The Asia Contact detail
        if (getSafe(() => bookingData.billingCountryIdFkeyrel.iso_code) || '') {
          let user_contact = '';
          switch (bookingData.billingCountryIdFkeyrel.iso_code) {
            case 'US':
              user_contact = 'USA: +1-818-798-3858';
              break;
            case 'CN':
              user_contact = 'CHINA: +86-400-842-8820';
              break;
            case 'KR':
              user_contact = 'KOREA: +82-70-7488-2237';
              break;
            case 'TH':
              user_contact = 'THAILAND: +66-2-104-0808';
              break;
            case 'SG':
              user_contact = 'SINGAPORE: +65-3157-0380';
              break;
            default:
              user_contact = 'THAILAND: +66-2-104-0808';
              break;
          }

          let product_contact = '';
          switch (getSafe(() => bookingData.tour.cities.city_country.iso_code)) {
            case 'US':
              product_contact = 'USA: +1-818-798-3858';
              break;
            case 'CN':
              product_contact = 'CNINA: +86-400-842-8820';
              break;
            case 'KR':
              product_contact = 'KOREA: +82-70-7488-2237';
              break;
            case 'TH':
              product_contact = 'THAILAND: +66-2-104-0808';
              break;
            case 'SG':
              product_contact = 'SINGAPORE: +65-3157-0380';
              break;
            default:
              product_contact = 'THAILAND: +66-2-104-0808';
              break;
          }

          if (user_contact != product_contact) {
            user_contact = `${user_contact}, ${product_contact}`;
          }
          doc
            .font(ralewayRegular)
            .fill(charcoalBlack)
            .fontSize(8)
            .text('The Asia Contact detail :', 40, 740);
          doc
            .font(ralewayBold)
            .fill(charcoalBlack)
            .fontSize(8)
            .text(`${user_contact}`, 130, 740);
        }

        // generate QR code and save in PDFDocument
        const language_id = bookingData.bookingUserIdFkeyrel.language_id;
        const languageObj = await Languages.findOne({ where: { id: language_id } });
        const iso_code_2 = languageObj.code.toLowerCase();
        const productURL = `${configHost.web_url}/${iso_code_2}/discover/${bookingData.tour.slug}/`;
        const qrCode = await QRCode.toDataURL(productURL);
        doc
          .font(ralewayBold)
          .fill(charcoalBlack)
          .fontSize(10)
          .text('View Tour', 480, 625);
        doc.image(qrCode, 450, 635, { scale: 0.6 });
      }

      doc.end();

      const writeStreamPromise = new Promise((resolve, reject) => {
        writeStream.on('error', err => reject({ status: false, message: err }));
        writeStream.on('finish', () => resolve({ status: true, message: 'success' }));
      });
      const writeStreamResolve = await writeStreamPromise;
      const responseObject = {
        status: writeStreamResolve.status,
        message: writeStreamResolve.message,
        filePath,
        booking_no: bookingData.booking_no,
      };

      return Promise.resolve(responseObject);
    } catch (e) {
      console.log('error in createVoucherFileData : ', e);
      // sendErrorToSlack(e, booking_id)
      return Promise.resolve({ status: 5000, message: e });
    }
  };

  Voucher.createVoucherFromHtml = async booking_id => {
    const Booking = Voucher.app.models.Booking;
    const Languages = Voucher.app.models.Languages;
    const CancellationPolicies = Voucher.app.models.CancellationPolicies;
    const bookingData = (await Booking.findById(booking_id, Booking.defaultFilter)).toObject();
    const featureData = await Voucher.app.models.Features.find();

    // generate QR code and save in PDFDocument
    const language_id = bookingData.bookingUserIdFkeyrel.language_id;
    const languageObj = await Languages.findOne({ where: { id: language_id } });
    const iso_code_2 = languageObj.code.toLowerCase();
    // const productURL = `${configHost.web_url}/${iso_code_2}/discover/${bookingData.tour.slug}/`
    // const qrCode = await QRCode.toDataURL(productURL)

    const voucherLocale = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../', 'helpers/locales/voucher/en.json'), 'utf8'),
    );
    const keyVoucherLocal = Object.keys(voucherLocale);
    const voucherLocaleDirectory = path.join(__dirname, '../../', 'helpers/locales/voucher');
    const voucherData = {};
    configure_i18n(voucherLocaleDirectory, iso_code_2);
    _.each(keyVoucherLocal, key => {
      voucherData[key] = i18n.__(key);
    });
    try {
      const headerTextArray = [];
      const dataTextArray = [];
      // Guest Name
      if (getSafe(() => bookingData.billing_first_name) || '') {
        headerTextArray.push(
          `${voucherData.guest_name} ${language_id != 1 ? `(${voucherLocale.guest_name})` : ''}`,
        );
        dataTextArray.push(`${bookingData.billing_first_name} ${bookingData.billing_last_name}`);
      }
      // No. of guest
      switch (getSafe(() => bookingData.tour.product_type)) {
        case 1:
          if (getSafe(() => bookingData.input_details.adult_pax) || '') {
            headerTextArray.push(
              `${voucherData.no_of_guest} ${
                language_id != 1 ? `(${voucherLocale.no_of_guest})` : ''
              }`,
            );
            const sum_pax =
              parseInt(bookingData.input_details.adult_pax, 10) +
              parseInt(bookingData.input_details.child_pax, 10);
            let tempString = `${sum_pax} (${bookingData.input_details.adult_pax} ${
              voucherData.adults
            }`;
            if (bookingData.input_details.child_pax > 0) {
              tempString += `/${bookingData.input_details.child_pax} ${voucherData.children}`;
            }
            tempString += ')';
            dataTextArray.push(tempString);
          }
          break;
        case 2: // transportration
          headerTextArray.push(
            `${voucherData.no_of_vehicle} ${
              language_id != 1 ? `(${voucherLocale.no_of_vehicle})` : ''
            }`,
          );
          dataTextArray.push(`${bookingData.input_details.adult_pax}`);
          break;
        case 3: // Luggage
          headerTextArray.push(
            `${voucherData.no_of_luggage} ${
              language_id != 1 ? `(${voucherLocale.no_of_luggage})` : ''
            }`,
          );
          dataTextArray.push(`${bookingData.input_details.adult_pax}`);
          break;
        case 4: // SIM
          headerTextArray.push(
            `${voucherData.no_of_sim} ${language_id != 1 ? `(${voucherLocale.no_of_sim})` : ''}`,
          );
          dataTextArray.push(`${bookingData.input_details.adult_pax}`);
          break;
        default:
      }
      // Selected date
      if (getSafe(() => bookingData.trip_starts) || '') {
        headerTextArray.push(
          `${voucherData.selected_date} ${
            language_id != 1 ? `(${voucherLocale.selected_date})` : ''
          }`,
        );
        dataTextArray.push(`${new Date(bookingData.trip_starts).toDateString()}`);
      }
      if (getSafe(() => bookingData.sub_product.departure) || '') {
        headerTextArray.push(
          `${voucherData.departure} ${language_id != 1 ? `(${voucherLocale.departure})` : ''}`,
        );
        dataTextArray.push(bookingData.sub_product.departure);
      } else if (getSafe(() => bookingData.tour.departure) || '') {
        headerTextArray.push(
          `${voucherData.departure} ${language_id != 1 ? `(${voucherLocale.departure})` : ''}`,
        );
        dataTextArray.push(bookingData.tour.departure);
      }

      if (getSafe(() => bookingData.sub_product.location) || '') {
        headerTextArray.push(
          `${voucherData.location} ${language_id != 1 ? `(${voucherLocale.location})` : ''}`,
        );
        dataTextArray.push(bookingData.sub_product.location);
      } else if (getSafe(() => bookingData.tour.location) || '') {
        headerTextArray.push(
          `${voucherData.location} ${language_id != 1 ? `(${voucherLocale.location})` : ''}`,
        );
        dataTextArray.push(bookingData.tour.location);
      }

      if (getSafe(() => bookingData.sub_product.tour_duration) || '') {
        headerTextArray.push(
          `${voucherData.duration} ${language_id != 1 ? `(${voucherLocale.duration})` : ''}`,
        );
        dataTextArray.push(bookingData.sub_product.tour_duration);
      } else if (getSafe(() => bookingData.tour.tour_duration) || '') {
        headerTextArray.push(
          `${voucherData.duration} ${language_id != 1 ? `(${voucherLocale.duration})` : ''}`,
        );
        dataTextArray.push(bookingData.tour.tour_duration);
      }

      if (getSafe(() => bookingData.drop_off_place) || '') {
        headerTextArray.push(
          `${voucherData.drop_off_place} ${
            language_id != 1 ? `(${voucherLocale.drop_off_place})` : ''
          }`,
        );
        dataTextArray.push(bookingData.drop_off_place);
      }

      if (getSafe(() => bookingData.hotel_name) || '') {
        headerTextArray.push(
          `${voucherData.hotel_name} ${language_id != 1 ? `(${voucherLocale.hotel_name})` : ''}`,
        );
        dataTextArray.push(bookingData.hotel_name);
      }

      // Product Type
      if (getSafe(() => bookingData.sub_product.product_features) || '') {
        headerTextArray.push(
          `${voucherData.product_type} ${
            language_id != 1 ? `(${voucherLocale.product_type})` : ''
          }`,
        );
        const subProductFeatures = JSON.parse(bookingData.sub_product.product_features);
        const found = featureData.find(
          element => element.id === parseInt(subProductFeatures[0], 10),
        );
        dataTextArray.push(getSafe(() => found.name) || '');
      } else if (getSafe(() => bookingData.tour.features[0].feature.name) || '') {
        headerTextArray.push(
          `${voucherData.product_type} ${
            language_id != 1 ? `(${voucherLocale.product_type})` : ''
          }`,
        );
        dataTextArray.push(bookingData.tour.features[0].feature.name);
      }

      // Pick up place
      if (getSafe(() => bookingData.pickup_place) || '') {
        headerTextArray.push(
          `${voucherData.pick_up_place} ${
            language_id != 1 ? `(${voucherLocale.pick_up_place})` : ''
          }`,
        );
        dataTextArray.push(bookingData.pickup_place);
      }

      // Pick up time
      if (getSafe(() => bookingData.pickup_time) || '') {
        headerTextArray.push(
          `${voucherData.pick_up_time} ${
            language_id != 1 ? `(${voucherLocale.pick_up_time})` : ''
          }`,
        );
        dataTextArray.push(bookingData.pickup_time);
      }

      // Pickup location and time
      // this change for prevent null and blank data but right now pickup_location_time is still update in tours not in sub_product
      if (getSafe(() => bookingData.pickup_location_time)) {
        headerTextArray.push(
          `${voucherData.pick_up_time_and_location} ${
            language_id != 1 ? `(${voucherLocale.pick_up_time_and_location})` : ''
          }`,
        );
        dataTextArray.push(`${bookingData.pickup_location_time}`);
      }

      if (getSafe(() => bookingData.selected_time)) {
        headerTextArray.push(
          `${voucherData.selected_time} ${
            language_id != 1 ? `(${voucherLocale.selected_time})` : ''
          }`,
        );
        dataTextArray.push(`${bookingData.selected_time}`);
      }

      // we will show this section when two of this section have blank
      if (
        getSafe(() => bookingData.pickup_place) == '' ||
        getSafe(() => bookingData.pickup_place) == null ||
        getSafe(() => bookingData.pickup_time) == '' ||
        getSafe(() => bookingData.pickup_time) == null
      ) {
        // Meeting Point
        if (getSafe(() => bookingData.meeting_point) || '') {
          headerTextArray.push(
            `${voucherData.meeting_point} ${
              language_id != 1 ? `(${voucherLocale.meeting_point})` : ''
            }`,
          );
          dataTextArray.push(bookingData.meeting_point);
        } else if (getSafe(() => bookingData.sub_product.meeting_point) || '') {
          headerTextArray.push(
            `${voucherData.meeting_point} ${
              language_id != 1 ? `(${voucherLocale.meeting_point})` : ''
            }`,
          );
          dataTextArray.push(bookingData.sub_product.meeting_point);
        } else if (getSafe(() => bookingData.tour.meeting_point) || '') {
          headerTextArray.push(
            `${voucherData.meeting_point} ${
              language_id != 1 ? `(${voucherLocale.meeting_point})` : ''
            }`,
          );
          dataTextArray.push(bookingData.tour.meeting_point);
        }

        // Meeting Time
        if (getSafe(() => bookingData.meeting_time) || '') {
          headerTextArray.push(
            `${voucherData.meeting_time} ${
              language_id != 1 ? `(${voucherLocale.meeting_time})` : ''
            }`,
          );
          dataTextArray.push(bookingData.meeting_time);
        } else if (getSafe(() => bookingData.sub_product.meeting_time) || '') {
          headerTextArray.push(
            `${voucherData.meeting_time} ${
              language_id != 1 ? `(${voucherLocale.meeting_time})` : ''
            }`,
          );
          dataTextArray.push(bookingData.sub_product.meeting_time);
        } else if (getSafe(() => bookingData.tour.meeting_time) || '') {
          headerTextArray.push(
            `${voucherData.meeting_time} ${
              language_id != 1 ? `(${voucherLocale.meeting_time})` : ''
            }`,
          );
          dataTextArray.push(bookingData.tour.meeting_time);
        }
      }

      if (getSafe(() => bookingData.sub_product.opening_time) || '') {
        headerTextArray.push(
          `${voucherData.opening_time} ${
            language_id != 1 ? `(${voucherLocale.opening_time})` : ''
          }`,
        );
        dataTextArray.push(bookingData.sub_product.opening_time);
      } else if (getSafe(() => bookingData.tour.opening_time) || '') {
        headerTextArray.push(
          `${voucherData.opening_time} ${
            language_id != 1 ? `(${voucherLocale.opening_time})` : ''
          }`,
        );
        dataTextArray.push(bookingData.tour.opening_time);
      }

      if (getSafe(() => bookingData.sub_product.show_time) || '') {
        headerTextArray.push(
          `${voucherData.show_time} ${language_id != 1 ? `(${voucherLocale.show_time})` : ''}`,
        );
        dataTextArray.push(bookingData.sub_product.show_time);
      } else if (getSafe(() => bookingData.tour.show_time) || '') {
        headerTextArray.push(
          `${voucherData.show_time} ${language_id != 1 ? `(${voucherLocale.show_time})` : ''}`,
        );
        dataTextArray.push(bookingData.tour.show_time);
      }

      // Special Request
      if (getSafe(() => bookingData.special_request) || '') {
        headerTextArray.push(
          `${voucherData.special_request} ${
            language_id != 1 ? `(${voucherLocale.special_request})` : ''
          }`,
        );
        dataTextArray.push(bookingData.special_request);
      }

      // Promotion Code
      if (getSafe(() => bookingData.promocode) || '') {
        headerTextArray.push(
          `${voucherData.promotion_code} ${language_id != 1 ? `(${voucherLocale.promocode})` : ''}`,
        );
        dataTextArray.push(bookingData.promocode);
      }

      // Exclude Include
      if (getSafe(() => bookingData.tour.excluded_included).length != 0) {
        const ex_included_list = getSafe(() => bookingData.tour.excluded_included);
        let include_list_name = '';
        let exclude_list_name = '';
        ex_included_list.forEach(element => {
          if (element.type) {
            if (include_list_name != '') include_list_name = `${include_list_name}, `;
            include_list_name = `${include_list_name}${element.exclude_include.name}`;
          } else {
            if (exclude_list_name != '') exclude_list_name = `${exclude_list_name}, `;
            exclude_list_name = `${exclude_list_name}${element.exclude_include.name}`;
          }
        });
        if (include_list_name != '') {
          headerTextArray.push(
            `${voucherData.included} ${language_id != 1 ? `(${voucherLocale.included})` : ''}`,
          );
          dataTextArray.push(include_list_name);
        }
        if (exclude_list_name != '') {
          headerTextArray.push(
            `${voucherData.excluded} ${language_id != 1 ? `(${voucherLocale.excluded})` : ''}`,
          );
          dataTextArray.push(exclude_list_name);
        }
      }
      // sub_product address
      if (getSafe(() => bookingData.sub_product.address) || '') {
        headerTextArray.push(
          `${voucherData.address} ${language_id != 1 ? `(${voucherLocale.address})` : ''}`,
        );
        dataTextArray.push(bookingData.sub_product.address);
      }

      // Contact detail address
      if (getSafe(() => bookingData.tour.suppliers.address) || '') {
        headerTextArray.push(
          `${voucherData.contact_detail_address} ${
            language_id != 1 ? `(${voucherLocale.contact_detail_address})` : ''
          }`,
        );
        dataTextArray.push(bookingData.tour.suppliers.address);
      }

      // Contact detail Tel.
      if (getSafe(() => bookingData.tour.suppliers.public_phone_number) || '') {
        headerTextArray.push(
          `${voucherData.contact_detail_tel} ${
            language_id != 1 ? `(${voucherLocale.contact_detail_tel})` : ''
          }`,
        );
        dataTextArray.push(
          `${bookingData.tour.suppliers.public_phone_number}, ${
            bookingData.tour.suppliers.business_phone_number
          }`,
        );
      }

      // notice detail
      let noticeHeader = '';
      let noticeData = '';
      if (getSafe(() => bookingData.sub_product.notice) || '') {
        noticeHeader = `${voucherData.note}  ${language_id != 1 ? `(${voucherLocale.note})` : ''}`;
        noticeData = JSON.parse(
          getSafe(
            () => bookingData.sub_product.localization.find(e => e.lang_id == language_id).notice,
          ) || bookingData.sub_product.notice,
        );
      }

      let subHeader = '';
      let subHeaderBracket = '';
      if (getSafe(() => bookingData.tour.name) != getSafe(() => bookingData.sub_product.name)) {
        subHeader = bookingData.sub_product.name;
        subHeaderBracket = `(${getSafe(
          () => bookingData.sub_product.localization.find(e => e.lang_id == language_id).name,
        )})`;
      }

      // The Asia Contact detail
      let user_contact = '';
      let product_contact = '';
      if (getSafe(() => bookingData.billingCountryIdFkeyrel.iso_code) || '') {
        switch (bookingData.billingCountryIdFkeyrel.iso_code) {
          case 'US':
            user_contact = 'USA: +1-818-798-3858';
            break;
          case 'CN':
            user_contact = 'CHINA: +86-400-842-8820';
            break;
          case 'KR':
            user_contact = 'KOREA: +82-70-7488-2237';
            break;
          case 'TH':
            user_contact = 'THAILAND: +66-2-104-0808';
            break;
          case 'SG':
            user_contact = 'SINGAPORE: +65-3157-0380';
            break;
          default:
            user_contact = 'THAILAND: +66-2-104-0808';
            break;
        }

        switch (getSafe(() => bookingData.tour.cities.city_country.iso_code)) {
          case 'US':
            product_contact = 'USA: +1-818-798-3858';
            break;
          case 'CN':
            product_contact = 'CNINA: +86-400-842-8820';
            break;
          case 'KR':
            product_contact = 'KOREA: +82-70-7488-2237';
            break;
          case 'TH':
            product_contact = 'THAILAND: +66-2-104-0808';
            break;
          case 'SG':
            product_contact = 'SINGAPORE: +65-3157-0380';
            break;
          default:
            product_contact = 'THAILAND: +66-2-104-0808';
            break;
        }

        if (user_contact != product_contact) {
          user_contact = `${user_contact}, ${product_contact}`;
        }
      }
      // Cancellation Policies
      // const cancellationPoliciesData = await CancellationPolicies.findById(bookingData.cancellation_policy_id)
      const cancellationPoliciesData = (await CancellationPolicies.find({
        where: { id: bookingData.cancellation_policy_id },
        include: { relation: 'localization' },
      }))[0];
      const cancelllationPoliciesDescription =
        getSafe(
          () =>
            cancellationPoliciesData.localization().find(e => e.lang_id == language_id).description,
        ) ||
        getSafe(() => cancellationPoliciesData.description) ||
        '';

      const isAffiliate = Number(bookingData.booking_method_id) === 3;

      const mainHeader = bookingData.tour.name;
      const mainHeaderBracket = `(${getSafe(
        () => bookingData.tour.localization.find(e => e.lang_id == language_id).name,
      )})`;

      let logoBuffer;
      let addressBuffer;
      logoBuffer = fs.readFileSync(
        path.join(__dirname, '../../', 'template/images/header.png'),
        'base64',
      );
      if (isAffiliate) {
        const url = `https://theasia.imgix.net/${
          bookingData.bookingUserIdFkeyrel.affiliates.logo
        }?fit=crop&w=200&h=100`;
        const imageRes = await axios.get(url, { responseType: 'arraybuffer' });
        // logoBuffer = Buffer.from(imageRes.data).toString('base64')
        addressBuffer = fs.readFileSync(
          path.join(__dirname, '../../', 'template/images/logo_gray.png'),
          'base64',
        );
      } else {
        // logoBuffer = fs.readFileSync(path.join(__dirname, '../../', 'template/images/header.png'), 'base64')
        addressBuffer = fs.readFileSync(
          path.join(__dirname, '../../', 'template/images/footer.png'),
          'base64',
        );
      }
      const stampBuffer = fs.readFileSync(
        path.join(__dirname, '../../', 'template/images/stamp.jpg'),
        'base64',
      );
      const objForPDF = {
        isAffiliate,
        imgData: `data:image/jpeg;base64, ${logoBuffer}`,
        labelBookingNo: `${voucherData.booking_voucher_no} (${voucherLocale.booking_voucher_no})`,
        beforeMainHeader: bookingData.booking_no,
        mainHeader,
        mainHeaderBracket,
        subHeader,
        subHeaderBracket,
        headerTextArray,
        dataTextArray,
        nArrays: headerTextArray.length,
        noticeHeader,
        noticeData,
        footer: {
          theAsiaContact: {
            label: 'The Asia Contact detail :',
            data: user_contact,
          },
          // qrCode: {
          //   label: 'View Tour',
          //   data: qrCode,
          //   width: '150px',
          //   height: '150px',
          // },
          cancellationPolicies: {
            label: 'Cancellation policy :',
            data: cancelllationPoliciesDescription,
          },
          address: {
            data: `data:image/jpeg;base64, ${addressBuffer}`,
            width: '450px',
          },
          stamp: {
            data: `data:image/jpeg;base64, ${stampBuffer}`,
            width: '180px',
          },
        },
      };
      const templatePath = './common/template/voucher/voucher.pug';
      const filePath = `./common/template/voucher/voucher_${bookingData.booking_no}.pdf`;

      const htmlToString = pug.renderFile(templatePath, {
        basedir: __dirname,
        ...objForPDF,
      });

      // const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
      // const page = await browser.newPage()
      // await page.goto(`data:text/html,${htmlToString}`, { waitUntil: 'networkidle0' })
      // await page.pdf({
      //   path: filePath,
      //   printBackground: true,
      //   format: 'A4'
      // });

      // await browser.close();

      // switch back to top after test is done

      console.time('chrome');
      console.time('chrome-launch');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      console.timeEnd('chrome-launch');
      console.time('chrome-page');
      const page = await browser.newPage();
      console.timeEnd('chrome-page');
      console.time('chrome-render');
      // await page.goto(`data:text/html,${htmlToString}`, { waitUntil: 'networkidle0' }) // not working, it will generate white page
      await page.setContent(htmlToString, { waitUntil: 'networkidle0' });
      console.timeEnd('chrome-render');
      console.time('chrome-pdf');
      await page.pdf({
        path: filePath,
        printBackground: true,
        format: 'A4',
      });
      console.timeEnd('chrome-pdf');

      console.time('chrome-close');
      await browser.close();
      console.timeEnd('chrome-close');
      console.timeEnd('chrome');

      return Promise.resolve({
        status: 1000,
        message: 'success',
        filePath,
        booking_no: bookingData.booking_no,
      });
    } catch (err) {
      console.log(err);
      return Promise.reject({ status: 5000, message: err });
    }
  };
  Voucher.remoteMethod('createVoucherFromHtml', {
    accepts: [
      { arg: 'booking_id', type: 'string', description: 'requied booking_id', required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/createVoucherFromHtml', verb: 'post' },
  });

  Voucher.createPdfToS3 = async booking_id => {
    if (!booking_id) return Promise.reject('No booking id data');
    // don't forget to remove images in models/voucher when remove next line
    // const pdfData = await Voucher.createVoucherFileData(booking_id)

    const pdfData = await Voucher.createVoucherFromHtml(booking_id);

    if (pdfData.status === 5000) {
      const errResponseObject = {
        status: 5001,
        message: 'create pdf file failed',
        origin:
          'This pdf file fail when writting to disk. Something went wrong in createVoucherFileData function',
      };
      sendErrorToSlack(errResponseObject, booking_id);
      return Promise.resolve(errResponseObject);
    }
    const fileData = fs.readFileSync(pdfData.filePath);
    const params = {
      ACL: 'authenticated-read',
      Bucket: folderBucket,
      Key: `pdf/voucher_${pdfData.booking_no}.pdf`,
      Body: fileData,
      ContentType: 'application/pdf',
    };
    // Don't upload to s3 for tests
    if (process.env.NODE_ENV === 'test')
      return Promise.resolve({ status: 1000, message: 'success pdf created' });
    let responseObject;
    try {
      // const s3response = s3.putObject(params).promise()
      const s3response = await new Promise((resolve, reject) => {
        s3.putObject(params, (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        });
      });
      responseObject = { status: 1000, message: 'success pdf created' };
    } catch (e) {
      responseObject = { status: 5000, message: 'upload to s3 failed', origin: e };
      sendErrorToSlack(responseObject, booking_id);
    } finally {
      if (fs.existsSync(pdfData.filePath)) {
        fs.unlinkSync(pdfData.filePath);
      }
      return Promise.resolve(responseObject);
    }
  };

  Voucher.remoteMethod('getVoucher', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: { source: 'body' },
        required: true,
      },
      {
        arg: 'req',
        type: 'object',
        http: { source: 'req' },
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });

  Voucher.remoteMethod('createPdfToS3', {
    accepts: [
      {
        arg: 'booking_id',
        type: 'string',
        description: 'requied booking_id',
        required: true,
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/createPdfToS3', verb: 'post' },
  });

  Voucher.updateVoucher = async booking_id => {
    try {
      const bookingData = await Voucher.app.models.Booking.findById(booking_id);
      if (!bookingData)
        return Promise.resolve({ status: 404, message: `Booking ${booking_id} not found` });

      await Voucher.removeVoucher(bookingData.id);

      const res = await Voucher.createPdfToS3(bookingData.id);
      if (res.status !== 1000)
        return Promise.resolve({
          status: 500,
          message: `Voucher for ${booking_id} was removed and could not be created.`,
        });

      return Promise.resolve(res);
    } catch (error) {
      console.log('Update voucher error:', error);
      return Promise.reject(error);
    }
  };

  Voucher.remoteMethod('updateVoucher', {
    accepts: [{ arg: 'booking_id', type: 'string', required: true }],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/updateVoucher', verb: 'post' },
  });
};
