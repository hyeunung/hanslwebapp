"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PurchaseNewMain from "@/components/purchase/PurchaseNewMain";
import EmailDrawer from "@/components/purchase/EmailDrawer";
import PurchaseListMain from "@/components/purchase/PurchaseListMain";

export default function DashboardMain() {
  const [isPurchaseFormOpen, setIsPurchaseFormOpen] = useState(false);
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);

  const handleEmailToggle = () => setIsEmailPanelOpen((prev) => !prev);

  return (
    <div className="space-y-6 w-full relative">
      {/* Compact New Purchase Card - 전체 폭 활용 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-lg card-shadow overflow-hidden w-full"
      >
        <Collapsible open={isPurchaseFormOpen} onOpenChange={setIsPurchaseFormOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full h-12 px-6 justify-between hover:bg-muted/50 rounded-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">새 발주서 작성</p>
                  <p className="text-xs text-muted-foreground">Create New Purchase Order</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isPurchaseFormOpen ? 180 : 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="w-7 h-7 rounded-md bg-muted flex items-center justify-center"
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border bg-muted/20">
            <div className="p-6">
              <PurchaseNewMain />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Main Dashboard Grid - 전체 폭 활용 */}
      <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[600px] w-full relative">
        <AnimatePresence>
          {isEmailPanelOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex-shrink-0 bg-card border border-border rounded-lg card-shadow flex flex-col overflow-hidden z-20"
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
                  onClick={handleEmailToggle}
                  className="w-7 h-7 p-0 rounded-md hover:bg-muted"
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
          <PurchaseListMain onEmailToggle={handleEmailToggle} showEmailButton={true} />
        </div>
      </div>
    </div>
  );
}
