import React from 'react';
import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div>
      <nav className="navigation">
        <div className="nav-brand">Next.js Sample</div>
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/products">Products</Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
};

export default Layout; 