const crypto = require('crypto');
const Funnel = require('../models/Funnel');

function slugPart(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateFunnelInput(body) {
  const { name, productName, description, price, currency, pixelId } = body;
  if (!name?.trim() || !productName?.trim() || !Number.isFinite(Number(price))) {
    return { error: 'Funnel name, product name, and a valid price are required.' };
  }
  const requestedImages = body.images ?? [];
  if (!Array.isArray(requestedImages)) {
    return { error: 'Product images must be provided as a list of image URLs.' };
  }
  const images = requestedImages.map((image) => (typeof image === 'string' ? image.trim() : '')).filter(Boolean);
  if (images.length > 6 || images.some((image) => !isHttpUrl(image))) {
    return { error: 'Add up to 6 valid HTTP or HTTPS product image URLs.' };
  }
  return {
    values: {
      name,
      productName,
      description,
      images,
      price: Number(price),
      currency: currency || 'NGN',
      pixelId
    }
  };
}

async function listFunnels(req, res, next) {
  try {
    const funnels = await Funnel.find({ owner: req.workspaceOwnerId }).sort({ createdAt: -1 });
    res.json(funnels);
  } catch (error) {
    next(error);
  }
}

async function createFunnel(req, res, next) {
  try {
    const { error, values } = validateFunnelInput(req.body);
    if (error) return res.status(400).json({ message: error });
    const funnel = await Funnel.create({
      owner: req.workspaceOwnerId,
      ...values,
      slug: `${slugPart(values.productName) || 'product'}-${crypto.randomBytes(3).toString('hex')}`
    });
    res.status(201).json(funnel);
  } catch (error) {
    next(error);
  }
}

async function updateFunnel(req, res, next) {
  try {
    const { error, values } = validateFunnelInput(req.body);
    if (error) return res.status(400).json({ message: error });
    const funnel = await Funnel.findOneAndUpdate(
      { _id: req.params.id, owner: req.workspaceOwnerId },
      { $set: values },
      { new: true, runValidators: true }
    );
    if (!funnel) return res.status(404).json({ message: 'Funnel not found.' });
    res.json(funnel);
  } catch (error) {
    next(error);
  }
}

async function getPublicFunnel(req, res, next) {
  try {
    const funnel = await Funnel.findOne({ slug: req.params.slug, active: true })
      .select('name productName description images price currency pixelId slug');
    if (!funnel) return res.status(404).json({ message: 'This product page is no longer available.' });
    res.json(funnel);
  } catch (error) {
    next(error);
  }
}

module.exports = { listFunnels, createFunnel, updateFunnel, getPublicFunnel };
