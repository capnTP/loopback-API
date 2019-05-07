const puppeteer = require('puppeteer')
const pug = require('pug')
const path = require('path')
const fs = require('fs')

module.exports = (AffiliatesInvoices) => {
  AffiliatesInvoices.observe('before save', async (ctx) => {
    if (ctx.data) {
      // console.log(ctx.data);
    }
  });
  AffiliatesInvoices.generateInvoice = async (voucherStatus) => {
    const logoBuffer = fs.readFileSync(path.join(__dirname, '../../', 'template/images/theasia-logo.png'), 'base64')
    const objForPDF = {
      logoPath: `data:image/jpeg;base64, ${logoBuffer}`,
      header: 'Hello, this is your invoice.',
      toName: 'The Big Bag Tour Company',
      toAddress: '1234/34 Times Square Building 24 Sukhumvit Road Asoke, Bangkok 10110 Thailand',
      refNo: '#123456789',
      issueDate: '2018-06-30',
      paymentDue: '2018-07-30',
      remark: 'Nam voluptur, optatus, ne rerist us recatia veleceatus et audis dollect atusand itatemos eius.',
      tableData: [
        {
          date: '2018-06-30',
          description: [
            'TOTAL NUMBER OF 42 BOOKINGS',
            'between 2018-06-01 to 2018-06-30',
            'For a complete breakdown of all bookings please see the attached pages',
          ],
          amount: '125,680.00',
        }
      ],
      subTotal: '125,680.00',
      optionData: [
        {
          optionName: 'VAT (7%)',
          amount: '9857.60',
        },
        {
          optionName: 'Service Charge (10%)',
          amount: '853.25',
        }
      ],
      grandTotal: '120,137.60',
      paymentOptions: {
        text: 'Our Bank details ar as follows:',
        bankName: 'Bangkok Bank PLC.',
        accountName: 'The Asia(Thai) Co.Ltd.',
        bankAddress: '12345 Silom Road, Bangkok 10110, Thailand',
        accountNo: '101-01010-0101',
        branch: 'Head Office, Silom',
        swiftCode: 'BKKHGSU-86383',
      },
      footerData: {
        companyAddres: 'The Asia(Thai) Co.Ltd. 15 Ekkamai Soi 4, Prakanong-Nua, Wattana, Bangkok 10110',
        phone: 'Tel +66(0) 2 255 7611-14 | Fax +66(0)2 255 7615 | info@theasia.com | www.theasia.com',
      },
      voucherStatus,
    };

    const templatePath = './common/template/invoice/invoice.pug'
    const filePath = './common/template/invoice/invoice_xxxx.pdf'

    const htmlToString = pug.renderFile(templatePath, {
      basedir: __dirname,
      ...objForPDF,
    })

    const browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(`data:text/html,${htmlToString}`, { waitUntil: 'networkidle0' })
    await page.pdf({
      path: filePath,
      printBackground: true,
      format: 'A4'
    });

    await browser.close();

    return Promise.resolve({
      status: 1000,
      message: 'success',
      filePath,
    })
  }
  AffiliatesInvoices.remoteMethod('generateInvoice', {
    accepts: [
      { arg: 'voucherStatus', type: 'string', description: 'status invoice PAID or CANCELLED' },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/generateInvoice', verb: 'post' },
  })
}
