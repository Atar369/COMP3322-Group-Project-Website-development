export default function DishRatingSummary({ item, onViewReviews, compact = false }) {
  const average = Number(item.average_rating) || 0;
  const count = Number(item.review_count) || 0;
  const label = count
    ? `${average.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'}`
    : 'No reviews yet';

  return (
    <div className={`dish-rating-summary${compact ? ' is-compact' : ''}`}>
      <span className="dish-rating-stars" aria-hidden="true">
        {'★'.repeat(Math.round(average))}{'☆'.repeat(5 - Math.round(average))}
      </span>
      {count > 0 && <strong>{average.toFixed(1)} avg</strong>}
      <span className="dish-rating-count">{count ? `(${count})` : 'No ratings yet'}</span>
      {onViewReviews && (
        <button type="button" className="dish-reviews-link" onClick={onViewReviews}>
          {count ? 'Ratings & reviews' : 'Be the first to review'}
        </button>
      )}
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
