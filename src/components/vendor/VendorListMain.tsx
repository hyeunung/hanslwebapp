"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, Save, X, Building, Phone, Mail, MapPin, User, Search, ChevronDown, ChevronRight, Check, UserPlus, Users, Settings } from 'lucide-react';

interface Vendor {
  id: number;
  vendor_name: string;
  vendor_address: string;
  vendor_phone: string;
  vendor_fax: string;
  vendor_payment_schedule: string;
  note?: string;
  contacts: VendorContact[];
}

interface VendorContact {
  id: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  position?: string;
}

interface VendorContactInput {
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  position: string;
}

export default function VendorListMain() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [localEditData, setLocalEditData] = useState<Partial<Vendor>>({});
  const [newVendor, setNewVendor] = useState<Partial<Vendor>>({
    vendor_name: '',
    vendor_address: '',
    vendor_phone: '',
    vendor_fax: '',
    vendor_payment_schedule: '',
    note: '',
  });
  const [newContacts, setNewContacts] = useState<VendorContactInput[]>([
    { contact_name: '', contact_email: '', contact_phone: '', position: '' },
  ]);
  const [contactsDraft, setContactsDraft] = useState<VendorContactInput[]>([]);
  
  // 통합된 담당자 관리 (기존 담당자 편집 + 새 담당자 추가)
  const [contactManageVendorId, setContactManageVendorId] = useState<number | null>(null);
  const [addContactDraft, setAddContactDraft] = useState<VendorContactInput[]>([{ contact_name: '', contact_email: '', contact_phone: '', position: '' }]);
  
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [editingContactData, setEditingContactData] = useState<Partial<VendorContact>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    const { data: vendorData } = await supabase
      .from('vendors')
      .select('*, vendor_contacts(*, vendors(vendor_name))');
    if (vendorData) {
      setVendors(
        vendorData.map((v: any) => ({
          ...v,
          contacts: (v.vendor_contacts || []).map((c: any) => ({
            ...c,
            vendor_name: v.vendor_name
          })),
        }))
      );
    }
  }

  // 검색 필터링 - 사용자의 수정사항 유지
  const filteredVendors = vendors.filter(vendor =>
    (vendor.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vendor.vendor_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (Array.isArray(vendor.contacts) ? vendor.contacts : []).some(contact => 
      (contact.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.contact_email || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // 인라인 수정 핸들러
  const handleEdit = (vendor: Vendor) => {
    setEditId(vendor.id);
    setLocalEditData({ ...vendor });
  };

  const handleLocalEditChange = (field: keyof Vendor, value: string) => {
    setLocalEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditSave = async () => {
    if (!editId) return;
    setEditLoading(true);
    const { vendor_name, vendor_address, vendor_phone, vendor_fax, vendor_payment_schedule, note } = localEditData;
    const { error } = await supabase.from('vendors').update({
      vendor_name,
      vendor_address,
      vendor_phone,
      vendor_fax,
      vendor_payment_schedule,
      note,
    }).eq('id', editId);
    setEditLoading(false);
    if (error) {
      alert('저장 실패: ' + error.message);
      return;
    }
    setEditId(null);
    setLocalEditData({});
    loadVendors();
    alert('저장되었습니다.');
  };

  const handleEditCancel = () => {
    setEditId(null);
    setLocalEditData({});
  };

  // 신규 등록 핸들러
  const handleNewChange = (field: keyof Vendor, value: string) => {
    setNewVendor((prev) => ({ ...prev, [field]: value }));
  };

  const handleNewContactChange = (idx: number, field: keyof VendorContactInput, value: string) => {
    setNewContacts((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleAddNewContact = () => {
    setNewContacts((prev) => [...prev, { contact_name: '', contact_email: '', contact_phone: '', position: '' }]);
  };

  const handleRemoveNewContact = (idx: number) => {
    setNewContacts((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  // 담당자 팝업 관련
  const handleOpenContactsModal = () => {
    setContactsDraft([...newContacts]);
    setIsContactsModalOpen(true);
  };

  const handleDraftContactChange = (idx: number, field: keyof VendorContactInput, value: string) => {
    setContactsDraft((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleAddDraftContact = () => {
    setContactsDraft((prev) => [...prev, { contact_name: '', contact_email: '', contact_phone: '', position: '' }]);
  };

  const handleRemoveDraftContact = (idx: number) => {
    setContactsDraft((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  const handleSaveContactsModal = () => {
    setNewContacts([...contactsDraft]);
    setIsContactsModalOpen(false);
  };

  // 신규 등록 저장
  const handleNewSave = async () => {
    if (!newVendor.vendor_name) return;
    // 1. 업체 등록
    const { data: vendorRes, error } = await supabase.from('vendors').insert(newVendor).select('id').single();
    if (error || !vendorRes) return;
    // 2. 담당자들 등록
    const contactsToInsert = newContacts.filter(c => c.contact_name.trim() !== '' || c.contact_email.trim() !== '');
    if (contactsToInsert.length > 0) {
      await supabase.from('vendor_contacts').insert(
        contactsToInsert.map(c => ({ ...c, vendor_id: vendorRes.id }))
      );
    }
    setNewVendor({
      vendor_name: '',
      vendor_address: '',
      vendor_phone: '',
      vendor_fax: '',
      vendor_payment_schedule: '',
      note: '',
    });
    setNewContacts([{ contact_name: '', contact_email: '', contact_phone: '', position: '' }]);
    setShowNewVendorForm(false);
    loadVendors();
  };

  const deleteVendor = async (id: number) => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      await supabase.from('vendors').delete().eq('id', id);
      loadVendors();
    }
  };

  // 통합된 담당자 관리 (기존 편집 + 새로 추가)
  const handleManageContacts = (vendorId: number) => {
    setContactManageVendorId(vendorId);
    setAddContactDraft([{ contact_name: '', contact_email: '', contact_phone: '', position: '' }]);
  };

  const handleCancelManageContacts = () => {
    setContactManageVendorId(null);
    setAddContactDraft([{ contact_name: '', contact_email: '', contact_phone: '', position: '' }]);
    setEditingContactId(null);
    setEditingContactData({});
  };

  const handleAddContactDraftChange = (idx: number, field: keyof VendorContactInput, value: string) => {
    setAddContactDraft((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleAddContactDraftAdd = () => {
    setAddContactDraft((prev) => [...prev, { contact_name: '', contact_email: '', contact_phone: '', position: '' }]);
  };

  const handleAddContactDraftRemove = (idx: number) => {
    setAddContactDraft((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  const handleAddContactSave = async () => {
    if (!contactManageVendorId) return;
    const contactsToInsert = addContactDraft.filter(c => c.contact_name.trim() !== '' || c.contact_email.trim() !== '');
    if (contactsToInsert.length > 0) {
      await supabase.from('vendor_contacts').insert(
        contactsToInsert.map(c => ({ ...c, vendor_id: contactManageVendorId }))
      );
    }
    setContactManageVendorId(null);
    setAddContactDraft([{ contact_name: '', contact_email: '', contact_phone: '', position: '' }]);
    loadVendors();
  };

  // 기존 담당자 편집
  const handleEditContact = (contact: VendorContact) => {
    setEditingContactId(contact.id);
    setEditingContactData({ ...contact });
  };

  const handleEditContactChange = (field: keyof VendorContact, value: string) => {
    setEditingContactData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditContactSave = async () => {
    if (!editingContactId) return;
    const { contact_name, contact_email, contact_phone, position } = editingContactData;
    const { error } = await supabase.from('vendor_contacts').update({
      contact_name,
      contact_email,
      contact_phone,
      position,
    }).eq('id', editingContactId);
    
    if (error) {
      alert('저장 실패: ' + error.message);
      return;
    }
    
    setEditingContactId(null);
    setEditingContactData({});
    loadVendors();
  };

  const handleEditContactCancel = () => {
    setEditingContactId(null);
    setEditingContactData({});
  };

  const handleDeleteContact = async (contactId: number) => {
    if (confirm('담당자 정보를 삭제하시겠습니까?')) {
      await supabase.from('vendor_contacts').delete().eq('id', contactId);
      loadVendors();
    }
  };

  // 현재 선택된 벤더 정보 가져오기
  const currentManageVendor = contactManageVendorId ? vendors.find(v => v.id === contactManageVendorId) : null;

  return (
    <div className="space-y-6">
      {/* Header - Clean and minimal */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="font-semibold text-foreground">거래처(벤더) 관리</h2>
            {vendors.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                {vendors.length}개 등록됨
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Vendor Management System</p>
        </div>
        
        <Button
          onClick={() => setShowNewVendorForm(!showNewVendorForm)}
          className="gap-2 rounded-md bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          새 벤더 등록
        </Button>
      </div>

      {/* Search - 좌측 정렬로 변경 */}
      <div className="flex justify-start">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="벤더명, 주소, 담당자명, 이메일로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 text-sm bg-background border-border rounded-md focus-ring"
          />
          {searchTerm && filteredVendors.length !== vendors.length && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <span className="text-xs text-muted-foreground bg-background px-2">
                {filteredVendors.length}개 검색됨
              </span>
            </div>
          )}
        </div>
      </div>

      {/* New Vendor Form */}
      <AnimatePresence>
        {showNewVendorForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Card className="border-border rounded-lg card-shadow">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-md flex items-center justify-center">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-medium text-foreground">새 벤더 등록</h3>
                </div>
                
                {/* Vendor Basic Info - 최적화된 그리드 레이아웃 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground">기본 정보</h4>
                  
                  {/* 첫 번째 행: 업체명 (전체 너비) */}
                  <div className="w-full">
                    <Input
                      placeholder="업체명 *"
                      value={newVendor.vendor_name || ''}
                      onChange={e => handleNewChange('vendor_name', e.target.value)}
                      className="h-9 bg-input-background border-border rounded-md focus-ring"
                    />
                  </div>
                  
                  {/* 두 번째 행: 주소 (전체 너비) */}
                  <div className="w-full">
                    <Input
                      placeholder="주소"
                      value={newVendor.vendor_address || ''}
                      onChange={e => handleNewChange('vendor_address', e.target.value)}
                      className="h-9 bg-input-background border-border rounded-md focus-ring"
                    />
                  </div>
                  
                  {/* 세 번째 행: 전화번호, 팩스, 결제조건 (3컬럼) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      placeholder="전화번호"
                      value={newVendor.vendor_phone || ''}
                      onChange={e => handleNewChange('vendor_phone', e.target.value)}
                      className="h-9 bg-input-background border-border rounded-md focus-ring"
                    />
                    <Input
                      placeholder="팩스"
                      value={newVendor.vendor_fax || ''}
                      onChange={e => handleNewChange('vendor_fax', e.target.value)}
                      className="h-9 bg-input-background border-border rounded-md focus-ring"
                    />
                    <Input
                      placeholder="결제조건"
                      value={newVendor.vendor_payment_schedule || ''}
                      onChange={e => handleNewChange('vendor_payment_schedule', e.target.value)}
                      className="h-9 bg-input-background border-border rounded-md focus-ring"
                    />
                  </div>
                  
                  {/* 네 번째 행: 비고 (전체 너비) */}
                  <div className="w-full">
                    <Input
                      placeholder="비고"
                      value={newVendor.note || ''}
                      onChange={e => handleNewChange('note', e.target.value)}
                      className="h-9 bg-input-background border-border rounded-md focus-ring"
                    />
                  </div>
                </div>

                {/* Contact Management - 항상 표시되도록 개선 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary/70" />
                    <h4 className="text-sm font-medium text-foreground">담당자 정보</h4>
                    <span className="text-xs text-muted-foreground">
                      ({newContacts.filter(c => c.contact_name.trim() !== '' || c.contact_email.trim() !== '').length}명)
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {newContacts.map((contact, idx) => (
                      <Card key={idx} className="border-border/50 bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-primary/10 rounded-md flex items-center justify-center">
                                <User className="w-3 h-3 text-primary" />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">담당자 {idx + 1}</span>
                            </div>
                            {newContacts.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveNewContact(idx)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              placeholder="이름"
                              value={contact.contact_name}
                              onChange={e => handleNewContactChange(idx, 'contact_name', e.target.value)}
                              className="h-8 text-xs bg-background border-border rounded-sm focus-ring"
                            />
                            <Input
                              placeholder="직책"
                              value={contact.position}
                              onChange={e => handleNewContactChange(idx, 'position', e.target.value)}
                              className="h-8 text-xs bg-background border-border rounded-sm focus-ring"
                            />
                            <Input
                              placeholder="이메일"
                              value={contact.contact_email}
                              onChange={e => handleNewContactChange(idx, 'contact_email', e.target.value)}
                              className="h-8 text-xs bg-background border-border rounded-sm focus-ring"
                            />
                            <Input
                              placeholder="전화번호"
                              value={contact.contact_phone}
                              onChange={e => handleNewContactChange(idx, 'contact_phone', e.target.value)}
                              className="h-8 text-xs bg-background border-border rounded-sm focus-ring"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddNewContact}
                      className="gap-2 w-full h-8 text-xs border-dashed border-primary/50 text-primary hover:bg-primary/5"
                    >
                      <Plus className="w-3 h-3" />
                      담당자 추가
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button
                    onClick={handleNewSave}
                    disabled={!newVendor.vendor_name}
                    className="gap-2 rounded-md"
                  >
                    <Save className="w-4 h-4" />
                    등록하기
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewVendorForm(false);
                    }}
                    className="gap-2 rounded-md"
                  >
                    <X className="w-4 h-4" />
                    취소
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vendor List */}
      <div className="space-y-4">
        {filteredVendors.map((vendor, index) => (
          <motion.div
            key={vendor.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, type: "spring", damping: 25 }}
          >
            <Card className="border-border rounded-lg card-shadow hover:card-shadow-hover transition-shadow duration-200">
              <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <h3 className="font-semibold text-foreground">{vendor.vendor_name}</h3>
                          {vendor.contacts.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{vendor.contacts.length}명</span>
                            </div>
                          )}
                    </div>
                  </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Company Info */}
                          <div className="lg:col-span-2 space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Building className="w-4 h-4 text-primary/70 flex-shrink-0" />
                              <span className="text-foreground font-medium">기본 정보</span>
                            </div>
                            <div className="pl-6 space-y-2 text-sm">
                              {vendor.vendor_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-foreground">{vendor.vendor_phone}</span>
                                </div>
                              )}
                              {vendor.vendor_address && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-foreground">{vendor.vendor_address}</span>
                                </div>
                              )}
                              {vendor.vendor_fax && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-foreground">FAX: {vendor.vendor_fax}</span>
                                </div>
                              )}
                              {vendor.vendor_payment_schedule && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">결제조건:</span>
                                  <span className="text-foreground">{vendor.vendor_payment_schedule}</span>
                                </div>
                              )}
                              {vendor.note && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">비고:</span>
                                  <span className="text-foreground">{vendor.note}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Contact Info - 구분선 제대로 적용 */}
                          <div className="space-y-3 lg:border-l lg:border-border lg:pl-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-primary/70 flex-shrink-0" />
                                <span className="text-foreground font-medium">담당자</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleManageContacts(vendor.id)}
                                className="text-xs h-7 px-2 rounded-md hover:bg-primary/10 text-primary"
                              >
                                <Users className="w-3.5 h-3.5 mr-1" />
                                추가/관리
                              </Button>
                            </div>
                            
                            {vendor.contacts.length > 0 ? (
                              <div className="space-y-3">
                        {/* 1~4명은 항상 2x2 grid, 5명 이상은 기존대로 */}
                        {vendor.contacts.length <= 4 ? (
                          <div className="grid grid-cols-2 grid-rows-2 gap-3">
                            {Array.from({ length: 4 }).map((_, i) => {
                              const contact = vendor.contacts[i];
                              return contact ? (
                                <Card key={contact.id} className="p-2 bg-muted/30 border-0 flex items-center min-h-[56px]">
                                  <div className="flex items-center gap-2 w-full">
                                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                      <User className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                    <div className="flex flex-1 min-w-0 items-center gap-2">
                                      <div className="flex flex-col min-w-0">
                                        <span className="font-medium text-sm text-foreground truncate">{contact.contact_name || contact.contact_email || '이름 없음'}</span>
                                        {contact.position && (
                                          <span className="text-xs text-muted-foreground">{contact.position}</span>
                                        )}
                                      </div>
                                      {(contact.contact_email || contact.contact_phone) && (
                                        <span className="mx-2 text-border">|</span>
                                      )}
                                      <div className="flex flex-col text-xs text-muted-foreground truncate min-w-0">
                                        {contact.contact_email && (
                                          <span className="flex items-center gap-1 truncate">
                                            <Mail className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{contact.contact_email}</span>
                                          </span>
                                        )}
                                        {contact.contact_phone && (
                                          <span className="flex items-center gap-1">
                                            <Phone className="w-3 h-3 flex-shrink-0" />
                                            <span>{contact.contact_phone}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ) : (
                                <div key={i} /> // 빈 칸
                              );
                            })}
                          </div>
                        ) : (
                          <>
                                {vendor.contacts.slice(0, 3).map((contact) => (
                                  <Card key={contact.id} className="p-3 bg-muted/30 border-0">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                          <User className="w-3.5 h-3.5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-foreground truncate">
                                            {contact.contact_name || contact.contact_email || '이름 없음'}
                                          </div>
                                          {contact.position && (
                                            <div className="text-xs text-muted-foreground">{contact.position}</div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="pl-9 space-y-1 text-xs text-muted-foreground">
                                        {contact.contact_email && (
                                          <div className="flex items-center gap-1.5 truncate">
                                            <Mail className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{contact.contact_email}</span>
                                          </div>
                                        )}
                                        {contact.contact_phone && (
                                          <div className="flex items-center gap-1.5">
                                            <Phone className="w-3 h-3 flex-shrink-0" />
                                            <span>{contact.contact_phone}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </Card>
                                ))}
                                {vendor.contacts.length > 3 && (
                                  <div className="text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleManageContacts(vendor.id)}
                                      className="text-xs text-muted-foreground hover:text-primary"
                                    >
                                      +{vendor.contacts.length - 3}명 더보기
                                    </Button>
                                  </div>
                            )}
                          </>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <User className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">등록된 담당자가 없습니다</p>
                              </div>
                            )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(vendor)}
                        className="gap-2 rounded-md"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        수정
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteVendor(vendor.id)}
                        className="gap-2 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        삭제
                      </Button>
                    </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredVendors.length === 0 && (
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {searchTerm ? '검색 조건에 맞는 벤더가 없습니다.' : '등록된 벤더가 없습니다.'}
          </p>
        </div>
      )}

      {/* Unified Contact Management Modal - 통합된 담당자 추가/관리 */}
      <Dialog open={contactManageVendorId !== null} onOpenChange={() => setContactManageVendorId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{currentManageVendor?.vendor_name}</div>
                <div className="text-sm text-muted-foreground">담당자 추가/관리</div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
            {/* Existing Contacts */}
            {currentManageVendor && currentManageVendor.contacts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-muted rounded-md flex items-center justify-center">
                    <User className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <h4 className="text-sm font-medium text-foreground">
                    기존 담당자 ({currentManageVendor.contacts.length}명)
                  </h4>
                </div>
                
                <div className="grid gap-3">
                  {currentManageVendor.contacts.map((contact) => (
                    <Card key={contact.id} className="border-border bg-gradient-to-r from-background to-muted/20">
                      <CardContent className="p-4">
                        {editingContactId === contact.id ? (
                          // Edit Mode for existing contact
                          <div className="space-y-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-primary/10 rounded-md flex items-center justify-center">
                                  <Edit className="w-3 h-3 text-primary" />
                                </div>
                                <span className="text-sm font-medium text-primary">편집 중</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={handleEditContactSave}
                                  className="h-7 px-3 text-xs gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  저장
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleEditContactCancel}
                                  className="h-7 px-3 text-xs gap-1"
                                >
                                  <X className="w-3 h-3" />
                                  취소
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                placeholder="이름"
                                value={editingContactData.contact_name || ''}
                                onChange={e => handleEditContactChange('contact_name', e.target.value)}
                                className="h-9 bg-background border-border rounded-md focus-ring"
                              />
                              <Input
                                placeholder="직책"
                                value={editingContactData.position || ''}
                                onChange={e => handleEditContactChange('position', e.target.value)}
                                className="h-9 bg-background border-border rounded-md focus-ring"
                              />
                              <Input
                                placeholder="이메일"
                                value={editingContactData.contact_email || ''}
                                onChange={e => handleEditContactChange('contact_email', e.target.value)}
                                className="h-9 bg-background border-border rounded-md focus-ring"
                              />
                              <Input
                                placeholder="전화번호"
                                value={editingContactData.contact_phone || ''}
                                onChange={e => handleEditContactChange('contact_phone', e.target.value)}
                                className="h-9 bg-background border-border rounded-md focus-ring"
                              />
                            </div>
                          </div>
                        ) : (
                          // View Mode for existing contact
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-foreground">
                                    {contact.contact_name || contact.contact_email || '이름 없음'}
                                  </span>
                                  {contact.position && (
                                    <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                      {contact.position}
                                    </Badge>
                                  )}
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  {contact.contact_email && (
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                      <span className="truncate">{contact.contact_email}</span>
                                    </div>
                                  )}
                                  {contact.contact_phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                                      <span>{contact.contact_phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditContact(contact)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteContact(contact.id)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Contacts */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-primary/10 rounded-md flex items-center justify-center">
                  <UserPlus className="w-3 h-3 text-primary" />
                </div>
                <h4 className="text-sm font-medium text-foreground">새 담당자 추가</h4>
              </div>
              
              <div className="space-y-3">
                {addContactDraft.map((contact, idx) => (
                  <Card key={idx} className="border-dashed border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary/10 rounded-md flex items-center justify-center">
                            <Plus className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">담당자 {idx + 1}</span>
                        </div>
                        {addContactDraft.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddContactDraftRemove(idx)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          placeholder="이름"
                          value={contact.contact_name}
                          onChange={e => handleAddContactDraftChange(idx, 'contact_name', e.target.value)}
                          className="h-9 bg-background border-border rounded-md focus-ring"
                        />
                        <Input
                          placeholder="직책"
                          value={contact.position}
                          onChange={e => handleAddContactDraftChange(idx, 'position', e.target.value)}
                          className="h-9 bg-background border-border rounded-md focus-ring"
                        />
                        <Input
                          placeholder="이메일"
                          value={contact.contact_email}
                          onChange={e => handleAddContactDraftChange(idx, 'contact_email', e.target.value)}
                          className="h-9 bg-background border-border rounded-md focus-ring"
                        />
                        <Input
                          placeholder="전화번호"
                          value={contact.contact_phone}
                          onChange={e => handleAddContactDraftChange(idx, 'contact_phone', e.target.value)}
                          className="h-9 bg-background border-border rounded-md focus-ring"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddContactDraftAdd}
                className="gap-2 w-full h-10 border-dashed border-primary/50 text-primary hover:bg-primary/5"
              >
                <Plus className="w-4 h-4" />
                담당자 추가
              </Button>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={handleCancelManageContacts}
              className="rounded-md"
            >
              취소
            </Button>
            <Button
              onClick={handleAddContactSave}
              className="gap-2 rounded-md"
            >
              <Save className="w-4 h-4" />
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
