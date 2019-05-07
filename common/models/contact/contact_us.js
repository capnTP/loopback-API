const sgMail = require('@sendgrid/mail');
const service = require('../../../server/config/env-service');

sgMail.setApiKey(service.sendgrid);

module.exports = function (ContactUs) {
  ContactUs.observe('after save', (ctx, next) => {
    const contact_data = {
      1: {
        amend_my_booking: {
          name: 'Amend my Booking',
          subject: 'Amend Request for The Asia Booking-EN',
          email: 'enservice@theasia.com',
        },
        check_status: {
          name: 'Check the status of my booking',
          subject: 'Check my Booking Status-EN',
          email: 'enservice@theasia.com',
        },
        technical_issue: {
          name: 'Technical issue',
          subject: 'Technical issue report-EN',
          email: 'enservice@theasia.com',
        },
        general: {
          name: 'General',
          subject: 'General Inquiry-EN',
          email: 'enservice@theasia.com',
        },
        affiliate_inquiry: {
          name: 'Affiliate Inquiry',
          subject: 'Affiliate Inquiry-EN',
          email: 'enservice@theasia.com',
        },
        supplier_inquiry: {
          name: 'Supplier Inquiry',
          subject: 'Supplier Inquiry-EN',
          email: 'enservice@theasia.com',
        },
      },
      2: {
        amend_my_booking: {
          name: '예약변경 요청',
          subject: 'Amend Request for The Asia Booking-KR',
          email: 'enservice@theasia.com',
        },
        check_status: {
          name: '예약확인 요청',
          subject: 'Check my Booking Status-KR',
          email: 'enservice@theasia.com',
        },
        technical_issue: {
          name: '기술적 문제 요청',
          subject: 'Technical issue report-KR',
          email: 'enservice@theasia.com',
        },
        general: {
          name: '일반문의사항',
          subject: 'General Inquiry-KR',
          email: 'enservice@theasia.com',
        },
        affiliate_inquiry: {
          name: 'Affiliate Inquiry',
          subject: 'Affiliate Inquiry-EN',
          email: 'enservice@theasia.com',
        },
        supplier_inquiry: {
          name: 'Supplier Inquiry',
          subject: 'Supplier Inquiry-EN',
          email: 'enservice@theasia.com',
        },
      },
      3: {
        amend_my_booking: {
          name: '更改我的预订',
          subject: 'Amend Request for The Asia Booking-CN',
          email: 'cnservice@theasia.com',
        },
        check_status: {
          name: '查看我的预订状态',
          subject: 'Check my Booking Status-CN',
          email: 'cnservice@theasia.com',
        },
        technical_issue: {
          name: '技术问题',
          subject: 'Technical issue report-CN',
          email: 'cnservice@theasia.com',
        },
        general: {
          name: '其他',
          subject: 'General Inquiry-CN',
          email: 'cnservice@theasia.com',
        },
        affiliate_inquiry: {
          name: 'Affiliate Inquiry',
          subject: 'Affiliate Inquiry-EN',
          email: 'enservice@theasia.com',
        },
        supplier_inquiry: {
          name: 'Supplier Inquiry',
          subject: 'Supplier Inquiry-EN',
          email: 'enservice@theasia.com',
        },
      },
      4: {
        amend_my_booking: {
          name: 'แก้ไขการจองของฉัน',
          subject: 'Amend Request for The Asia Booking-TH',
          email: 'enservice@theasia.com',
        },
        check_status: {
          name: 'ตรวจสอบสถานะการจองของฉัน',
          subject: 'Check my Booking Status-TH',
          email: 'enservice@theasia.com',
        },
        technical_issue: {
          name: 'ปัญหาทางเทคนิค',
          subject: 'Technical issue report-TH',
          email: 'enservice@theasia.com',
        },
        general: {
          name: 'ปัญหาทั่วไป',
          subject: 'General Inquiry-TH',
          email: 'enservice@theasia.com',
        },
        affiliate_inquiry: {
          name: 'Affiliate Inquiry',
          subject: 'Affiliate Inquiry-EN',
          email: 'enservice@theasia.com',
        },
        supplier_inquiry: {
          name: 'Supplier Inquiry',
          subject: 'Supplier Inquiry-EN',
          email: 'enservice@theasia.com',
        },
      },

    }
    if (ctx.isNewInstance) {
      try {
        if(!ctx.instance.lang_id) {
          ctx.instance.lang_id  = 1;
        }
        const name = ctx.instance.name
        const subject = contact_data[ctx.instance.lang_id][ctx.instance.category].subject
        const email = ctx.instance.email
        const message = ctx.instance.message;
        const booking_no = ctx.instance.booking_no;
        const to = 'cs@theasia.com'; //send all email to this , ovverride
        let email_message;
        email_message = `${email_message}<b>Name:</b>${name}<br>`;
        email_message = `${email_message}<b>Email:<b>${email}<br>`;
        email_message = `${email_message}<b>BID:<b>${booking_no}<br><br>`;
        email_message = `${email_message}<b>Message :<b> &nbsp;${message}<br>`;

        const data = {
          to,
          from: 'contactus@theasia.com',
          subject,
          text: subject,
          html: email_message,
        };
        sgMail.send(data, (err, success) => {
          console.log(err, success);
          next();
        })
      }
      catch(err){
        console.log(err)
        //const e = new Error('Please fill Mandatory Information.')
        next(err)
      }
    } else {
      next();
    }
  })
};
