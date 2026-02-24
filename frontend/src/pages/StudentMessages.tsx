
import { useState, useEffect } from "react";
import StudentMessagesTab from "@/components/StudentMessagesTab";
import { BackButton } from "@/components/BackButton";
import DeveloperCredit from "@/components/DeveloperCredit";
import { MessageSquare } from "lucide-react";
import { auth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

const StudentMessages = () => {
    const navigate = useNavigate();

    useEffect(() => {
        if (!auth.isAuthenticated() || !auth.hasRole('student')) {
            navigate("/login");
        }
    }, [navigate]);

    return (
        <div className="flex-1 flex flex-col bg-transparent">
            <DeveloperCredit />
            <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
                <div className="w-full px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
                    {/* Header */}
                    <div className="mb-6 flex items-end justify-between border-b pb-4">
                        <div>
                            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">
                                Messages <span className="text-primary/40">Center</span>
                            </h1>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                Connect with Admins and Office Bearers
                            </p>
                        </div>

                    </div>

                    {/* Messages Content */}
                    <div className="flex-1 flex flex-col min-h-0 bg-card/50 backdrop-blur-sm border border-border/50 rounded-[2rem] overflow-hidden shadow-2xl">
                        <StudentMessagesTab />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StudentMessages;
