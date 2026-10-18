import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"ConceptChek · Make understanding visible",description:"Explain an idea, test it in a fresh case, and see what changed."};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
