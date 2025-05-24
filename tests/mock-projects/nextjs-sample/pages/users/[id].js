import Link from "next/link";
import { useRouter } from "next/router";

export default function UserProfile() {
  const router = useRouter();
  const { id } = router.query;

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div>
      <h1>User Profile: {id}</h1>
      <p>Viewing profile for user: {id}</p>

      <button onClick={handleGoBack}>Go Back</button>

      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </div>
  );
}
