'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import ItemsTable from './ItemsTable';

interface Item {
  line_number: number;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price_value: number;
  unit_price_currency: string;
  amount_value: number;
  amount_currency: string;
  remark: string;
}

interface FormData {
  items: Item[];
  currency: string;
}

export default function ItemsTableExample() {
  const [currency, setCurrency] = useState('KRW');
  
  const { control, handleSubmit, setValue, watch } = useForm<FormData>({
    defaultValues: {
      currency: 'KRW',
      items: [
        {
          line_number: 1,
          item_name: "",
          specification: "",
          quantity: 1,
          unit_price_value: 0,
          unit_price_currency: "KRW",
          amount_value: 0,
          amount_currency: "KRW",
          remark: "",
        },
      ],
    },
  });

  const onSubmit = (data: FormData) => {
    console.log('제출된 데이터:', data);
    alert('데이터가 저장되었습니다!');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">품목 테이블 사용 예제</h1>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <ItemsTable
          control={control}
          currency={currency}
          onCurrencyChange={(newCurrency) => {
            setCurrency(newCurrency);
            setValue('currency', newCurrency);
          }}
          onSubmit={handleSubmit(onSubmit)}
          userId="example_user"
          submitButtonText="저장하기"
          showSubmitButton={true}
          showTotalSummary={true}
          showCurrencySelector={true}
          className="mb-6"
        />
      </form>

      {/* 사용법 설명 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">ItemsTable 사용법</h2>
        <div className="space-y-2 text-sm">
          <p><strong>필수 Props:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>control</code>: react-hook-form의 control 객체</li>
            <li><code>currency</code>: 현재 통화 ('KRW' | 'USD')</li>
            <li><code>onCurrencyChange</code>: 통화 변경 콜백</li>
          </ul>
          
          <p className="mt-3"><strong>선택 Props:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>onSubmit</code>: 제출 버튼 클릭 시 실행될 함수</li>
            <li><code>userId</code>: 컬럼 너비 저장용 사용자 ID (기본값: 'guest')</li>
            <li><code>submitButtonText</code>: 제출 버튼 텍스트 (기본값: '저장')</li>
            <li><code>showSubmitButton</code>: 제출 버튼 표시 여부 (기본값: true)</li>
            <li><code>showTotalSummary</code>: 총합 표시 여부 (기본값: true)</li>
            <li><code>showCurrencySelector</code>: 통화 선택기 표시 여부 (기본값: true)</li>
            <li><code>className</code>: 추가 CSS 클래스</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 