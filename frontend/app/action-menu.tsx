"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActionMenu({ onShowQuickActions }: { onShowQuickActions: () => void }) {
  return (
    <div className="fixed bottom-8 right-8 z-50">
      <Button
        size="icon"
        className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-110"
        onClick={onShowQuickActions}
      >
        <MoreHorizontal className="h-6 w-6" />
      </Button>
    </div>
  );
}