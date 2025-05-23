import Link from "next/link";

export default function About() {
  return (
    <div>
      <h1>About Us</h1>
      <p>This is the about page of our Next.js app.</p>

      <nav>
        <Link href="/">Home</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/blog">Blog</Link>
      </nav>
    </div>
  );
}
