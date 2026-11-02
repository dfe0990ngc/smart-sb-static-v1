import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section-padding">
      <div className="container not-found-card">
        <span className="eyebrow">404</span>
        <h1>Page not found</h1>
        <p>The page or update you are looking for is not available.</p>
        <Link className="primary-action" href="/">Return home</Link>
      </div>
    </section>
  );
}
