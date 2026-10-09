import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, money } from '../api'
import LoadingIndicator from '../components/LoadingIndicator'
import nigerianStates from '../../shared/nigerianStates.json'

const blank = {
  customerName: '',
  phone: '',
  whatsapp: '',
  address: '',
  city: '',
  state: '',
  quantity: '1',
}

function getDiscountRateForQuantity(quantity) {
  if (quantity >= 4) return 0.07
  if (quantity >= 3) return 0.06
  if (quantity >= 2) return 0.05
  return 0
}

function getDiscountedTotal(unitPrice, quantity) {
  const numericQuantity = Number(quantity)
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return 0
  const discountRate = getDiscountRateForQuantity(numericQuantity)
  return Number((unitPrice * numericQuantity * (1 - discountRate)).toFixed(2))
}

export default function PublicFunnel() {
  const { slug } = useParams()
  const [funnel, setFunnel] = useState(null)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState('')

  useEffect(() => {
    setLoading(true)
    setFunnel(null)
    setError('')
    api(`/public/funnels/${slug}`)
      .then(setFunnel)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!funnel?.pixelId) return undefined
    const w = window
    if (!w.fbq) {
      const fbq = function (...args) {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, args)
        else fbq.queue.push(args)
      }
      fbq.queue = []
      fbq.loaded = true
      fbq.version = '2.0'
      w.fbq = fbq
      w._fbq = fbq
      const script = document.createElement('script')
      script.async = true
      script.src = 'https://connect.facebook.net/en_US/fbevents.js'
      document.head.appendChild(script)
    }
    w.fbq('init', funnel.pixelId)
    w.fbq('track', 'PageView')
    w.fbq('track', 'ViewContent', {
      content_name: funnel.productName,
      value: funnel.price,
      currency: funnel.currency,
    })
    return undefined
  }, [funnel])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api(`/public/funnels/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setSuccess(result.orderNumber)
      if (window.fbq)
        window.fbq('track', 'Purchase', {
          value: getDiscountedTotal(funnel.price, form.quantity),
          currency: funnel.currency,
        })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const quantity = Number(form.quantity) || 1
  const discountPercent = Math.round(getDiscountRateForQuantity(quantity) * 100)
  const orderTotal = getDiscountedTotal(funnel?.price || 0, quantity)

  return (
    <main className='storefront'>
      <header className='store-header'>
        <a className='brand' href='/'>
          <span className='brand-mark'>G</span>
          <span>
            GBN <b>Supply Chain</b>
          </span>
        </a>
        <span className='store-trust'>
          ✳ &nbsp; Trusted delivery, right to your door
        </span>
      </header>
      {error && !funnel && <div className='store-load-error'>{error}</div>}
      {loading && <LoadingIndicator message='Loading product…' />}
      {funnel && (
        <div className='store-layout'>
          <section className='store-product'>
            <div className={`store-image${funnel.images?.length ? ' has-photo' : ''}`}>
              {funnel.images?.length ? (
                <img
                  className='store-product-photo'
                  src={
                    funnel.images.includes(selectedImage)
                      ? selectedImage
                      : funnel.images[0]
                  }
                  alt={funnel.productName}
                />
              ) : (
                <>
                  <div className='store-image-ring' />
                  <div className='store-product-object'>◈</div>
                </>
              )}
            </div>
            {funnel.images?.length > 1 && (
              <div className='store-gallery' aria-label='Product photos'>
                {funnel.images.map((image, index) => (
                  <button
                    className={`store-thumbnail${(funnel.images.includes(selectedImage) ? selectedImage : funnel.images[0]) === image ? ' selected' : ''}`}
                    key={`${image}-${index}`}
                    type='button'
                    onClick={() => setSelectedImage(image)}
                    aria-label={`View product photo ${index + 1}`}
                    aria-pressed={
                      (funnel.images.includes(selectedImage)
                        ? selectedImage
                        : funnel.images[0]) === image
                    }
                  >
                    <img src={image} alt='' />
                  </button>
                ))}
              </div>
            )}
            <div className='store-product-copy'>
              <span className='store-overline'>MADE TO BE YOURS</span>
              <h1>{funnel.productName}</h1>
              <strong className='store-price'>
                {money(funnel.price, funnel.currency)}
              </strong>
              <p>
                {funnel.description ||
                  'A thoughtful choice for your everyday. Make it yours today and pay only when it arrives at your door.'}
              </p>
              <div className='store-benefits'>
                <span>✓ &nbsp; Pay on delivery</span>
                <span>✓ &nbsp; Free delivery</span>
                <span>
                  ✓ &nbsp; Nationwide Delivery Across Nigeria directly to your
                  doorstep
                </span>
              </div>
              <div className='social-proof'>
                <span className='proof-stars'>A GOOD CHOICE</span>
                <span>Order today. Pay when it arrives.</span>
              </div>
            </div>
          </section>
          <section className='store-order-panel'>
            <section className='store-faq' aria-labelledby='store-faq-heading'>
              <p className='store-overline'>NEED TO KNOW</p>
              <h2 id='store-faq-heading'>Frequently asked questions</h2>
              <div className='store-faq-list'>
                <details>
                  <summary>Do you deliver outside Lagos?</summary>
                  <p>Yes, we deliver nationwide.</p>
                </details>
                <details>
                  <summary>Can I pay on delivery?</summary>
                  <p>Yes, payment on delivery is available.</p>
                </details>
                <details>
                  <summary>How long does delivery take?</summary>
                  <p>Usually 24-72 hours depending on your location.</p>
                </details>
                <details>
                  <summary>Is this product Original?</summary>
                  <p>
                    Yes, we only sell carefully selected smart watches trusted
                    by our customers. Direct importation, you can be rest
                    assured.
                  </p>
                </details>
              </div>
            </section>
            {success ? (
              <div className='order-success'>
                <span className='success-mark'>✓</span>
                <span className='store-overline'>
                  IT’S OFFICIALLY ON ITS WAY
                </span>
                <h2>Thank you for your order.</h2>
                <p>
                  We’ll give you a call shortly to confirm the details. Have
                  your phone nearby.
                </p>
                <div className='confirmation-number'>
                  <small>YOUR ORDER NUMBER</small>
                  <strong>{success}</strong>
                </div>
                <a href={`/track/${success}`} className='button primary full'>
                  Track your order <span>→</span>
                </a>
              </div>
            ) : (
              <>
                <span className='store-overline'>READY TO MAKE IT YOURS?</span>
                <h2>Place your order</h2>
                <p className='store-form-intro'>
                  Only serious customers should fill this form. Please order
                  only if you’re ready to receive your items and pay on
                  delivery.
                </p>
                <form className='store-form' onSubmit={submit}>
                  <label>
                    Your full name
                    <input
                      autoComplete='name'
                      required
                      maxLength='100'
                      value={form.customerName}
                      onChange={(e) =>
                        setForm({ ...form, customerName: e.target.value })
                      }
                      placeholder='First and last name'
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      autoComplete='tel'
                      type='tel'
                      required
                      maxLength='24'
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      placeholder='+234 800 000 0000'
                    />
                  </label>
                  <label>
                    WhatsApp number
                    <input
                      autoComplete='tel'
                      type='tel'
                      required
                      maxLength='24'
                      value={form.whatsapp}
                      onChange={(e) =>
                        setForm({ ...form, whatsapp: e.target.value })
                      }
                      placeholder='+234 800 000 0000'
                    />
                  </label>
                  <label>
                    Delivery address
                    <textarea
                      autoComplete='street-address'
                      required
                      maxLength='500'
                      rows='2'
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                      placeholder='Street, area, nearest landmark'
                    />
                  </label>
                  <div className='form-row'>
                    <label>
                      State
                      <select
                        autoComplete='address-level1'
                        required
                        value={form.state}
                        onChange={(e) =>
                          setForm({ ...form, state: e.target.value })
                        }
                      >
                        <option value=''>Select state</option>
                        {nigerianStates.map((state) => (
                          <option key={state} value={state}>
                            {state === 'FCT'
                              ? 'Federal Capital Territory (FCT)'
                              : state}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      City / town
                      <input
                        autoComplete='address-level2'
                        required
                        maxLength='100'
                        value={form.city}
                        onChange={(e) =>
                          setForm({ ...form, city: e.target.value })
                        }
                        placeholder='Enter your city or town'
                      />
                    </label>
                  </div>
                  <label>
                    Quantity
                    <select
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: e.target.value })
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'item' : 'items'} ·{' '}
                          {money(
                            getDiscountedTotal(funnel.price, n),
                            funnel.currency,
                          )}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className='order-total'>
                    <span>Total · pay on delivery</span>
                    <strong>{money(orderTotal, funnel.currency)}</strong>
                    {discountPercent > 0 && (
                      <small>{discountPercent}% bundle discount applied</small>
                    )}
                  </div>
                  <label className='intent-check'>
                    <input required type='checkbox' />
                    <span>
                      I’m a serious customer and I’m ready to receive this order
                      and pay the full amount when it arrives.
                    </span>
                  </label>
                  {error && <div className='form-error'>{error}</div>}
                  <button
                    className='button primary full order-submit'
                    disabled={busy}
                  >
                    {busy ? 'Placing your order…' : 'Yes, place my order'}{' '}
                    <span>→</span>
                  </button>
                  <p className='secure-note'>
                    By placing your order, you agree to be contacted by phone to
                    confirm delivery details.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>
      )}
      <footer className='store-footer public-funnel-footer'>
        <div className='store-footer-row'>
          <span>Made for the journey. Delivered with care.</span>
          <span>© 2026 GBN Supply Chain</span>
        </div>
        <p className='store-footer-disclaimer'>
          This site is not in affiliation or direct or indirect sponsorship with
          Facebook inc., they are not responsible for user experience on this
          site.
        </p>
      </footer>
    </main>
  )
}
