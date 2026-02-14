/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { Popover, Transition } from "@headlessui/react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import apiClient from "@/lib/api";

// A button to show user some account actions
//  1. Billing: open a Stripe Customer Portal to manage their billing (cancel subscription, update payment method, etc.).
//     You have to manually activate the Customer Portal in your Stripe Dashboard (https://dashboard.stripe.com/test/settings/billing/portal)
//     This is only available if the customer has a customerId (they made a purchase previously)
//  2. Logout: sign out and go back to homepage
// See more at https://shipfa.st/docs/components/buttonAccount
const ButtonAccount = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [user, setUser] = useState(null);

	useEffect(() => {
		const getUser = async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			setUser(user);
		};

		getUser();
	}, []);

	const handleSignOut = async () => {
		const supabase = createClient();
		await supabase.auth.signOut();
		window.location.href = "/";
	};

	const handleBilling = async () => {
		setIsLoading(true);

		try {
			const { url } = await apiClient.post("/stripe/create-portal", {
				returnUrl: window.location.href,
			});

			window.location.href = url;
		} catch (e) {
			console.error(e);
		}

		setIsLoading(false);
	};

	return (
		<Popover className="relative z-10">
			{({ open }) => (
				<>
					<Popover.Button className="btn">
						{user?.user_metadata?.avatar_url ? (
							<img
								src={user?.user_metadata?.avatar_url}
								alt={"Profile picture"}
								className="w-6 h-6 rounded-full shrink-0"
								referrerPolicy="no-referrer"
								width={24}
								height={24}
							/>
						) : (
							<span className="w-8 h-8 bg-base-100 flex justify-center items-center rounded-full shrink-0 capitalize">
								{user?.email?.charAt(0)}
							</span>
						)}

						{user?.user_metadata?.name ||
							user?.email?.split("@")[0] ||
							"Account"}

						{isLoading ? (
							<span className="loading loading-spinner loading-xs"></span>
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								className={`w-5 h-5 duration-200 opacity-50 ${
									open ? "transform rotate-180 " : ""
								}`}
							>
								<path
									fillRule="evenodd"
									d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
									clipRule="evenodd"
								/>
							</svg>
						)}
					</Popover.Button>
					<Transition
						enter="transition duration-100 ease-out"
						enterFrom="transform scale-95 opacity-0"
						enterTo="transform scale-100 opacity-100"
						leave="transition duration-75 ease-out"
						leaveFrom="transform scale-100 opacity-100"
						leaveTo="transform scale-95 opacity-0"
					>
						<Popover.Panel className="absolute left-0 z-10 mt-3 w-screen max-w-[16rem] transform">
							<div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-base-content/10 bg-base-100 p-1">
								<div className="space-y-0.5 text-sm">
									<Link
										href="/user/settings"
										className="flex items-center gap-2 hover:bg-base-300 duration-200 py-1.5 px-4 w-full rounded-lg font-medium"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											className="w-5 h-5"
										>
											<path
												fillRule="evenodd"
												d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L3 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l1.734-.99a1 1 0 011.364.372zm8.764 0a1 1 0 011.364-.372l1.734.99A.996.996 0 0119 6v2a1 1 0 11-2 0v-.277l-1.254.145a1 1 0 11-.992-1.736L14.984 6l-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364-.372L10 8.848l1.254-.716a1 1 0 11.992 1.736L11 10.723V12a1 1 0 11-2 0v-1.277l-1.246-.855a1 1 0 01-.372-1.364zm8.764 0a1 1 0 011.364-.372l1.734.99a.996.996 0 01.52.878v2a1 1 0 11-2 0v-.723l-1.254.145a1 1 0 11-.992-1.736l1.23-.132-.23-.132a1 1 0 01-.372-1.364zm-3.528 3.504a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736l-1.75-1a1 1 0 01-.992-1.736zm-2.256 0a1 1 0 00-.992 1.736l1.75 1a1 1 0 11.992-1.736l-1.75-1zm8.764 0a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736l-1.75-1a1 1 0 01-.992-1.736zm-5.264 0a1 1 0 00-.992 1.736l.75.43a1 1 0 11-.992 1.736l-.75-.43a1 1 0 01-.992-1.736z"
												clipRule="evenodd"
											/>
										</svg>
										Settings
									</Link>
									<button
										className="flex items-center gap-2 hover:bg-base-300 duration-200 py-1.5 px-4 w-full rounded-lg font-medium"
										onClick={handleBilling}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											className="w-5 h-5"
										>
											<path
												fillRule="evenodd"
												d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm4.75-.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z"
												clipRule="evenodd"
											/>
										</svg>
										Billing
									</button>
									<button
										className="flex items-center gap-2 hover:bg-error/20 hover:text-error duration-200 py-1.5 px-4 w-full rounded-lg font-medium"
										onClick={handleSignOut}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											className="w-5 h-5"
										>
											<path
												fillRule="evenodd"
												d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
												clipRule="evenodd"
											/>
											<path
												fillRule="evenodd"
												d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z"
												clipRule="evenodd"
											/>
										</svg>
										Logout
									</button>
								</div>
							</div>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	);
};

export default ButtonAccount;
