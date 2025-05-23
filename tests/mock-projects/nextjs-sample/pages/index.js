import Link from "next/link";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  const handleNavigation = () => {
    router.push("/about");
  };

  const handleUserNavigation = (userId) => {
    router.push(`/users/${userId}`);
  };

  return (
    <div>
      <h1>Next.js Home</h1>
      <p>Welcome to the Next.js sample app!</p>

      <nav>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/blog">Blog</Link>
      </nav>

      <div>
        <button onClick={handleNavigation}>Go to About</button>
        <button onClick={() => handleUserNavigation("123")}>
          View User 123
        </button>
      </div>

      <div>
        <Link href="/users/admin">Admin Profile</Link>
        <Link href="/users/guest">Guest Profile</Link>
      </div>
    </div>
  );
}
