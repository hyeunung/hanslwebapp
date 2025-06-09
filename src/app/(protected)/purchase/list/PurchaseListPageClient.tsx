"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PurchaseListMain from "@/components/purchase/PurchaseListMain";
import EmailDrawer from "@/components/purchase/EmailDrawer";
import CommonLayout from "@/components/layout/CommonLayout";
import { Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PurchaseListPageClient() {
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);

  const toggleEmailPanel = () => {
    setIsEmailPanelOpen(!isEmailPanelOpen);
  };

  return (
    <CommonLayout title="발주 목록" description="Purchase Order List">
      <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px] w-full relative">
        <AnimatePresence>
          {isEmailPanelOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex-shrink-0 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col overflow-hidden z-20"
              style={{ minWidth: 320, maxWidth: 400 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-md flex items-center justify-center">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">이메일 작성</h3>
                    <p className="text-xs text-muted-foreground">Email Composition</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleEmailPanel}
                  className="w-7 h-7 p-0 rounded-md hover:bg-muted hover:shadow-sm transition-shadow duration-200"
                >
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <EmailDrawer />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 min-w-0">
          <PurchaseListMain onEmailToggle={toggleEmailPanel} showEmailButton={false} />
        </div>
      </div>
    </CommonLayout>
  );
}