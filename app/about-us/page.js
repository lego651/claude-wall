import Link from "next/link";
import Image from "next/image";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `About Us | ${config.appName}`,
  description: "Meet the team behind ShipFast - passionate developers helping entrepreneurs launch their startups faster.",
  canonicalUrlRelative: "/about-us",
});

const teamMembers = [
  {
    name: "Marc Louvion",
    role: "Founder & CEO",
    bio: "Full-stack developer with 8+ years of experience. Built ShipFast to help entrepreneurs ship faster.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80",
    twitter: "https://twitter.com/marc_louvion",
    linkedin: "https://linkedin.com/in/marclouvion"
  },
  {
    name: "Sarah Chen",
    role: "Lead Developer",
    bio: "Frontend specialist with a passion for creating beautiful, performant user experiences.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3276&q=80",
    twitter: "https://twitter.com/sarahchen",
    linkedin: "https://linkedin.com/in/sarahchen"
  },
  {
    name: "Alex Rodriguez",
    role: "Backend Engineer",
    bio: "Infrastructure and API expert. Ensures ShipFast runs smoothly and scales effortlessly.",
    image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80",
    twitter: "https://twitter.com/alexrod",
    linkedin: "https://linkedin.com/in/alexrodriguez"
  }
];

const AboutUs = () => {
  return (
    <main className="max-w-6xl mx-auto px-8 py-24">
      {/* Back Button */}
      <div className="mb-8">
        <Link href="/" className="btn btn-ghost">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </Link>
      </div>

      {/* Header Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
          About {config.appName}
        </h1>
        <p className="text-xl text-base-content/80 max-w-3xl mx-auto leading-relaxed">
          We&apos;re a passionate team of developers and entrepreneurs on a mission to help you ship your ideas faster.
          Built by makers, for makers.
        </p>
      </div>

      {/* Mission Section */}
      <div className="mb-20">
        <div className="card bg-base-200 card-border">
          <div className="card-body text-center">
            <h2 className="card-title text-3xl font-bold justify-center mb-4">Our Mission</h2>
            <p className="text-lg text-base-content/80 max-w-4xl mx-auto">
              Too many great ideas never see the light of day because developers get stuck building the same
              foundational features over and over again. ShipFast eliminates that friction by providing a
              battle-tested, modern boilerplate that handles authentication, payments, databases, and deployment
              out of the box. We believe your time should be spent building what makes your product unique,
              not recreating the wheel.
            </p>
          </div>
        </div>
      </div>

      {/* Team Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">Meet Our Team</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teamMembers.map((member, index) => (
            <div key={index} className="card bg-base-100 card-border">
              <figure className="px-6 pt-6">
                <div className="avatar">
                  <div className="w-32 h-32 rounded-full">
                    <Image
                      src={member.image}
                      alt={member.name}
                      width={128}
                      height={128}
                      className="rounded-full object-cover"
                    />
                  </div>
                </div>
              </figure>
              <div className="card-body text-center">
                <h3 className="card-title justify-center text-xl">{member.name}</h3>
                <p className="text-primary font-semibold">{member.role}</p>
                <p className="text-base-content/70 text-sm">{member.bio}</p>
                <div className="flex justify-center gap-3 mt-4">
                  <a
                    href={member.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-circle btn-sm btn-ghost"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-circle btn-sm btn-ghost"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Values Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Speed</h3>
            <p className="text-base-content/70">
              We help you ship faster by removing the repetitive setup work so you can focus on what matters.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Quality</h3>
            <p className="text-base-content/70">
              Every component is built with modern best practices, tested thoroughly, and production-ready.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Community</h3>
            <p className="text-base-content/70">
              We&apos;re builders supporting builders. Join our community of makers shipping amazing products.
            </p>
          </div>
        </div>
      </div>

      {/* Contact CTA */}
      <div className="text-center">
        <div className="card bg-primary text-primary-content card-border">
          <div className="card-body">
            <h2 className="card-title text-2xl justify-center mb-4">Get in Touch</h2>
            <p className="mb-6">
              Have questions or want to collaborate? We&apos;d love to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`mailto:${config.resend.supportEmail}`}
                className="btn btn-secondary"
              >
                Send us an Email
              </a>
              <a
                href="https://shipfa.st/discord"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-secondary"
              >
                Join our Discord
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AboutUs;