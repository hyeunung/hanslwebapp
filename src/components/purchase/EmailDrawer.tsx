"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function EmailDrawer() {
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("basic");

  const handleSend = () => {
    console.log("이메일 전송:", { recipients, subject, body, template });
    alert("이메일이 전송되었습니다.");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">템플릿</Label>
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger className="h-8 text-sm bg-background border-border rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="basic">기본 템플릿</SelectItem>
              <SelectItem value="urgent">긴급 발주</SelectItem>
              <SelectItem value="approval">승인 요청</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">받는 사람</Label>
          <Input
            placeholder="이메일 주소를 입력하세요"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            className="h-8 text-sm bg-background border-border rounded-md focus-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">제목</Label>
          <Input
            placeholder="이메일 제목"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-8 text-sm bg-background border-border rounded-md focus-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">내용</Label>
          <Textarea
            placeholder="이메일 내용을 입력하세요..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[120px] text-sm bg-background border-border rounded-md focus-ring resize-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-7 px-2 rounded-md text-xs"
          >
            <Paperclip className="w-3 h-3" />
            첨부
          </Button>
          <Badge variant="outline" className="text-xs">
            발주서 자동 첨부
          </Badge>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-md text-xs"
        >
          임시저장
        </Button>
        <Button
          onClick={handleSend}
          size="sm"
          className="flex-1 gap-2 rounded-md text-xs bg-primary hover:bg-primary/90"
        >
          <Send className="w-3 h-3" />
          전송
        </Button>
      </div>
    </div>
  );
}
