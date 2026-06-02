import { describe, expect, test } from 'bun:test';
import {
  extractAxisDatePair,
  extractAxisTrailingFields,
  extractOptionalAxisChequeNumber,
  extractAxisBranchNameFromBlock,
  pickDominantAxisBranchName,
} from './axisStatementParser';

describe('Axis statement parser helpers', () => {
  test('extracts both fused and spaced date columns', () => {
    expect(
      extractAxisDatePair('01-01-202401-01-2024 UPI/P2M/102842298645/APPLE MED 100.00 CR 200.00')
    ).toEqual({
      transactionDateRaw: '01-01-2024',
      valueDateRaw: '01-01-2024',
      remainder: 'UPI/P2M/102842298645/APPLE MED 100.00 CR 200.00',
    });

    expect(
      extractAxisDatePair('01-01-2024 01-01-2024 UPI/P2M/102842298645/APPLE MED 100.00 CR 200.00')
    ).toEqual({
      transactionDateRaw: '01-01-2024',
      valueDateRaw: '01-01-2024',
      remainder: 'UPI/P2M/102842298645/APPLE MED 100.00 CR 200.00',
    });
  });

  test('extracts trailing amount, direction, and balance when DR or CR is spaced', () => {
    expect(
      extractAxisTrailingFields('CLG/.../AMRUT 000025 17,405.00 CR 224,555.27')
    ).toEqual({
      remainder: 'CLG/.../AMRUT 000025',
      amount: '17,405.00',
      drCr: 'CR',
      balance: '224,555.27',
    });
  });

  test('extracts cheque number even when the PDF collapses the column gap to one space', () => {
    expect(
      extractOptionalAxisChequeNumber('SAK/CASH WDL/SAK468708991/848/VARACHHA /JATIN 820467')
    ).toEqual({
      narration: 'SAK/CASH WDL/SAK468708991/848/VARACHHA /JATIN',
      chequeNumber: '820467',
    });

    expect(
      extractOptionalAxisChequeNumber('UPI/P2M/102842298645/APPLE MED/HDFC BANK/APPLE MED')
    ).toEqual({
      narration: 'UPI/P2M/102842298645/APPLE MED/HDFC BANK/APPLE MED',
      chequeNumber: null,
    });
  });

  test('extracts fused cheque number generically when the numeric suffix already exists earlier in the narration', () => {
    expect(
      extractOptionalAxisChequeNumber('CLG/000025/100326/Bank Of Ba/AMRUT000025')
    ).toEqual({
      narration: 'CLG/000025/100326/Bank Of Ba/AMRUT',
      chequeNumber: '000025',
    });

    expect(
      extractOptionalAxisChequeNumber('CLG/000119/100326/Bank Of Ba/PRINCE000119')
    ).toEqual({
      narration: 'CLG/000119/100326/Bank Of Ba/PRINCE',
      chequeNumber: '000119',
    });

    expect(
      extractOptionalAxisChequeNumber('ABC/123456/BENEFICIARY123456')
    ).toEqual({
      narration: 'ABC/123456/BENEFICIARY',
      chequeNumber: '123456',
    });
  });

  test('does not split fused trailing reference codes when the digits are not repeated earlier', () => {
    expect(
      extractOptionalAxisChequeNumber('ACH-DR-HDFC BANK LIMITED-0000142323270-UTIB701290')
    ).toEqual({
      narration: 'ACH-DR-HDFC BANK LIMITED-0000142323270-UTIB701290',
      chequeNumber: null,
    });

    expect(
      extractOptionalAxisChequeNumber('UPI/P2A/710637930776/Google Pl/UTIB701290')
    ).toEqual({
      narration: 'UPI/P2A/710637930776/Google Pl/UTIB701290',
      chequeNumber: null,
    });
  });

  test('extracts a branch-name candidate from the transaction branch lines', () => {
    expect(
      extractAxisBranchNameFromBlock([
        '04-03-202604-03-2026',
        'UPI/P2M/102842298645/APPLE MED/HDFC BANK/Executio//P2V/               864.00DR           308168.27',
        'VARACHHA ROAD, SURAT',
        '[GJ]',
      ])
    ).toBe('VARACHHA ROAD, SURAT');

    expect(
      extractAxisBranchNameFromBlock([
        '06-03-202606-03-2026',
        'INB/IFT/REEMA KALPESH PADSHALA/TPARTY',
        'TRANSFER           4000000.00CR',
        '4190053.27',
        'VARACHHA ROAD, SURAT',
        '[GJ]',
      ])
    ).toBe('VARACHHA ROAD, SURAT');
  });

  test('picks the dominant branch name generically across mixed transaction branches', () => {
    expect(
      pickDominantAxisBranchName([
        'VARACHHA ROAD, SURAT',
        '[GJ]',
        'VARACHHA ROAD, SURAT',
        'CCGOI HYDERABAD HYD',
        'VARACHHA ROAD, SURAT',
        'TG',
      ])
    ).toBe('VARACHHA ROAD, SURAT');
  });
});
