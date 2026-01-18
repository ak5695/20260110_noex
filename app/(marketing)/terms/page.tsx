"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
    const router = useRouter();

    return (
        <div className="min-h-full flex flex-col dark:bg-[#1F1F1F]">
            <div className="max-w-3xl mx-auto px-6 py-6 w-full">
                <Button
                    onClick={() => router.back()}
                    variant="ghost"
                    size="sm"
                    className="mb-8 gap-x-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>

                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-black/5 dark:border-white/5 rounded-3xl p-8 md:p-12 shadow-xl">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8">Terms of Service</h1>

                    <div className="space-y-6 text-muted-foreground leading-relaxed">
                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
                            <p>
                                By accessing and using Rhizo, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">2. Use License</h2>
                            <p>
                                Permission is granted to temporarily download one copy of the materials (information or software) on Rhizo for personal, non-commercial transitory viewing only.
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Modify or copy the materials;</li>
                                <li>Use the materials for any commercial purpose;</li>
                                <li>Attempt to decompile or reverse engineer any software contained on the website;</li>
                                <li>Remove any copyright or other proprietary notations from the materials.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">3. Disclaimer</h2>
                            <p>
                                The materials on Rhizo are provided on an 'as is' basis. Rhizo makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">4. Limitations</h2>
                            <p>
                                In no event shall Rhizo or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Rhizo.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">5. Revisions and Errata</h2>
                            <p>
                                The materials appearing on Rhizo could include technical, typographical, or photographic errors. Rhizo does not warrant that any of the materials on its website are accurate, complete, or current.
                            </p>
                        </section>
                    </div>

                    <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 text-sm text-muted-foreground">
                        Last updated: January 18, 2026
                    </div>
                </div>
            </div>
        </div>
    );
}
