const fs = require('fs')
const _ = require('lodash')
const formidable = require('formidable')

const { constants: { isProduction } } = require('../../utility')

const BUCKET = isProduction ? 'theasia-cloud' : 'theasia-cloud/sandbox'
module.exports = function (Medias) {
  Medias.beforeRemote('find', (ctx, media, next) => {
    ctx.args.filter = {
      include: 'localization',
      ...ctx.args.filter,
    }
    return next()
  })

  Medias.beforeRemote('findById', (ctx, media, next) => {
    ctx.args.filter = {
      include: 'localization',
      ...ctx.args.filter,
    }
    return next()
  })

  Medias.observe('after save', async (ctx) => {
    try {
      if (!ctx.instance || !ctx.instance.id || !ctx.instance.tour_id) return Promise.resolve()
      if (ctx.instance.tour_id) {
        const ToursMedias = Medias.app.models.ToursMedias
        const newTourMediaObject = {
          tour_id: ctx.instance.tour_id,
          media_id: ctx.instance.id,
          is_primary: (ctx.instance.is_primary || false),
          is_thumbnail: (ctx.instance.is_thumbnail || false),
        }
        await ToursMedias.findOrCreate({ where: { tour_id: ctx.instance.tour_id, media_id: ctx.instance.id } }, newTourMediaObject)
      }
      return Promise.resolve()
    } catch (error) {
      console.log('after 1 save error', error)
      return Promise.resolve()
    }
  })

  Medias.observe('after save', async (ctx) => {
    try {
      if (!ctx.data || !ctx.data.id || !ctx.data.tour_id || !ctx.where || !ctx.where.id) return Promise.resolve()
      if (ctx.data.is_primary || ctx.data.is_thumbnail) {
        const ToursMedias = Medias.app.models.ToursMedias
        const tourMedia = await ToursMedias.findById(ctx.data.id)
        if (ctx.data.is_primary) {
          await ToursMedias.updateAll({ tour_id: ctx.data.tour_id }, { is_primary: false })
          await tourMedia.updateAttribute('is_primary', true)
        }
        if (ctx.data.is_thumbnail) {
          await ToursMedias.updateAll({ tour_id: ctx.data.tour_id }, { is_thumbnail: false })
          await tourMedia.updateAttribute('is_thumbnail', true)
        }
      }
      return Promise.resolve()
    } catch (error) {
      console.log('after 2 save error', error)
      return Promise.resolve()
    }
  })

  Medias.observe('before delete', async (ctx) => {
    try {
      const Container = Medias.app.models.Container
      const ToursMedias = Medias.app.models.ToursMedias
      const media = await Medias.findById(ctx.where.id)
      if (!media) return Promise.resolve()
      await new Promise((resolve, reject) => {
        Container.removeFile(`${BUCKET}/${media.bucket_path}`, media.name, (err, result) => {
          if (err) return (reject)
          return resolve(result)
        })
      })
      await ToursMedias.destroyAll({ media_id: media.id })
      return Promise.resolve()
    } catch (error) {
      console.log('before delete', error)
      return Promise.reject(error)
    }
  })

  const createLocalDir = () => {
    try {
      const { name: storageName, root: storageRoot } = Medias.app.dataSources.storage.settings
      if (storageName === 'storage') {
        const path = `${storageRoot}${BUCKET}/`
        // console.log("storage path",path)
        if (!fs.existsSync(path)) {
          fs.mkdirSync(path)
        }
      }
    } catch (error) {
      console.log(error)
    }
  }

  const uploadToS3 = (req, res, bucket_path, is_uniq = false) => new Promise((resolve, reject) => {
    // const Container = is_uniq ? Medias.app.models.ContainerUniq : Medias.app.models.Container
    const Container = Medias.app.models.Container
    Container.upload(req, res, {
      container: bucket_path,
    }, (error, fileObj) => {
      if (error) return reject(error)
      return resolve(fileObj.files.file[0])
    })
  })

  Medias.uploadForTour = function (req, res, tour_id, body, cb) {
    if (!tour_id) cb(null, { message: 'tour id not defined.', status: 0 })

    createLocalDir()

    const bucket_path = `tours/${tour_id}`
    // uploadToS3(req, res, `${BUCKET}/${bucket_path}`, true)
    uploadToS3(req, res, `${BUCKET}/${bucket_path}`)
    .then((fileInfo) => {
      const absolute_url = (fileInfo.providerResponse && fileInfo.providerResponse.location)
      return Medias.create({
        name: fileInfo.name,
        absolute_url,
        mime_type: fileInfo.type,
        size: fileInfo.size,
        bucket_path,
        tour_id,
      })
    })
    .then(media => cb(null, media))
    .catch(error => cb(error))
  }

  Medias.uploadImage = async function (req, res, bucket_path, body) {
    createLocalDir();
    if (!bucket_path) {
      return Promise.resolve({ status: false, message: 'bucket_path is required' })
    }
    const fileInfo = await uploadToS3(req, res, `${BUCKET}/${bucket_path}`)
    if (fileInfo) {
      const absolute_url = (fileInfo.providerResponse && fileInfo.providerResponse.location)
      const data = {
        status: true,
        name: fileInfo.name,
        absolute_url,
        full_url: `${bucket_path}/${fileInfo.name}`,
        mime_type: fileInfo.type,
        size: fileInfo.size,
        bucket_path,
      }
      return Promise.resolve(data)
    }
    return Promise.resolve({ status: false, message: 'Upload failed' })
  }

  Medias.uploadPayoutAttachments = async function (req, res, bucket_path, body) {
    createLocalDir();
    if (!bucket_path) {
      return Promise.resolve({ status: false, message: 'bucket_path is required' })
    }
    const fileInfo = await uploadToS3(req, res, `${BUCKET}/${bucket_path}`)
    if (fileInfo) {
      const absolute_url = (fileInfo.providerResponse && fileInfo.providerResponse.location)
      const data = {
        status: true,
        name: fileInfo.name,
        absolute_url,
        full_url: `${bucket_path}/${fileInfo.name}`,
        mime_type: fileInfo.type,
        size: fileInfo.size,
        bucket_path,
      }
      const payout_id = bucket_path.split('/')[1];
      const Payouts = Medias.app.models.Payouts;
      const result = await Payouts.addAttachment(payout_id,[`${bucket_path}/${fileInfo.name}`]);
      return Promise.resolve({...result,...data});
    }
    return Promise.resolve({ status: false, message: 'Upload failed' })
  }

  Medias.remoteMethod('uploadImage', {
    description: 'Uploads a file',
    accepts: [
      { arg: 'req', type: 'object', http: { source: 'req' } },
      { arg: 'res', type: 'object', http: { source: 'res' } },
      { arg: 'bucket_path', type: 'String' },
      { arg: 'body', type: 'object', http: { source: 'body' } },
    ],
    returns: {
      arg: 'fileObject',
      type: 'object',
      root: true,
    },
    http: {
      verb: 'post',
      path: '/uploadImage',
    },
  })

  Medias.remoteMethod('uploadPayoutAttachments', {
    description: 'Uploads a file',
    accepts: [
      { arg: 'req', type: 'object', http: { source: 'req' } },
      { arg: 'res', type: 'object', http: { source: 'res' } },
      { arg: 'bucket_path', type: 'String' },
      { arg: 'body', type: 'object', http: { source: 'body' } },
    ],
    returns: {
      arg: 'fileObject',
      type: 'object',
      root: true,
    },
    http: {
      verb: 'post',
      path: '/uploadPayoutAttachments',
    },
  })

  Medias.remoteMethod('uploadForTour', {
    description: 'Uploads a file',
    accepts: [
      { arg: 'req', type: 'object', http: { source: 'req' } },
      { arg: 'res', type: 'object', http: { source: 'res' } },
      { arg: 'tour_id', type: 'String' },
      { arg: 'body', type: 'object', http: { source: 'body' } },
    ],
    returns: {
      arg: 'fileObject',
      type: 'object',
      root: true,
    },
    http: {
      verb: 'post',
      path: '/uploadForTour/:tour_id',
    },
  })

  Medias.uploadTempolarly = function (req, res, body, callback) {
    uploadToS3(req, res, 'theasia-uploader').then((fileInfo) => {
      const response = {
        name: fileInfo.name,
        absolute_url: (fileInfo.providerResponse && fileInfo.providerResponse.location),
        mime_type: fileInfo.type,
        size: fileInfo.size,
      }
      callback(null, response)
    }).catch((error) => {
      console.log(error)
      callback(error)
    })
  }
  Medias.remoteMethod('uploadTempolarly', {
    description: 'uploadTempolarlys a file',
    accepts: [
      { arg: 'req', type: 'object', http: { source: 'req' } },
      { arg: 'res', type: 'object', http: { source: 'res' } },
      { arg: 'body', type: 'object', http: { source: 'body' } },
    ],
    returns: {
      arg: 'fileObject',
      type: 'object',
      root: true,
    },
    http: {
      verb: 'post',
      path: '/uploadTempolarly',
      description: 'upload file for attatch in email for backoffice',
    },
  })
}
