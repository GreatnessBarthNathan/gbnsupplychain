import { useRef } from 'react'
export default function ProductCarousel({ products, caption }) {
  const carouselRef = useRef(null)

  if (!products?.length) return null

  function scroll(direction) {
    const carousel = carouselRef.current
    if (!carousel) return
    const card = carousel.querySelector('.product-carousel-card')
    carousel.scrollBy({
      left: direction * (card?.getBoundingClientRect().width || carousel.clientWidth),
      behavior: 'smooth',
    })
  }

  return (
    <section className='product-carousel' aria-label={caption}>
      <div className='product-carousel-heading'>
        <h2>{caption}</h2>
        <div className='product-carousel-controls'>
          <button
            type='button'
            aria-label='Show previous products'
            onClick={() => scroll(-1)}
          >
            ‹
          </button>
          <button
            type='button'
            aria-label='Show more products'
            onClick={() => scroll(1)}
          >
            ›
          </button>
        </div>
      </div>
      <div className='product-carousel-track' ref={carouselRef}>
        {products.map((product) => (
          <a
            className='product-carousel-card'
            href={`/f/${product.slug}`}
            key={product.slug}
          >
            {product.images?.[0] ? (
              <img
                className='product-carousel-image'
                src={product.images[0]}
                alt={product.productName}
                loading='lazy'
              />
            ) : (
              <span className='product-carousel-image product-carousel-placeholder'>
                {product.productName}
              </span>
            )}
            <span className='product-carousel-name'>{product.productName}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
