import { formatRestaurantDateTime } from '../utils/restaurantTime';

export default function DishCustomerReviews({ reviews, reviewCount, loading = false, error = '' }) {
  return (
    <div className="dish-review-list">
      <h3>Customer reviews <span>({reviewCount || 0})</span></h3>
      {loading ? (
        <p className="dish-reviews-state">Loading customer reviews…</p>
      ) : error ? (
        <p className="error-text" role="alert">{error}</p>
      ) : reviews?.length ? reviews.map(review => (
        <article className="dish-review-entry" key={review.review_id}>
          <div className="dish-review-entry-heading">
            <strong>{review.reviewer_name}</strong>
            <span className="dish-rating-stars" aria-label={`${review.rating} out of 5 stars`}>
              {'★'.repeat(Number(review.rating))}{'☆'.repeat(5 - Number(review.rating))}
            </span>
          </div>
          <time className="dish-review-date" dateTime={review.updated_at}>
            {formatRestaurantDateTime(review.updated_at).split(' ')[0]}
          </time>
          {review.comment && <p>{review.comment}</p>}
        </article>
      )) : (
        <p className="dish-reviews-state">No reviews yet. Be the first to share what you think.</p>
      )}
    </div>
  );
}
