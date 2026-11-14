/**
 * QuantityStepper.tsx
 * Control chọn và nhập số lượng vật phẩm chuẩn giao diện mobile:
 * - Hàng gọn: Nhãn & Đơn vị bên trái, cụm [-] [Số] [+] bên phải.
 * - Vùng chạm nút tối thiểu 48 × 48 dp.
 * - Cho phép sửa trực tiếp bằng bàn phím số, chuẩn hóa khi blur.
 * - Ràng buộc: Số nguyên từ 1 đến 2.147.483.647.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Colors, BorderRadius, Shadows } from '../../constants/theme';
import {
  MIN_QUANTITY,
  MAX_QUANTITY,
  validateQuantity,
  normalizeQuantityOnCommit,
  incrementQuantity,
  decrementQuantity,
} from '../delivery/quantityHelper';

export interface QuantityStepperProps {
  value: string;
  onChangeValue: (val: string) => void;
  unit?: string;
  label?: string;
  disabled?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChangeValue,
  unit = 'Hộp',
  label = 'Số lượng',
  disabled = false,
  onValidationChange,
}) => {
  const [localError, setLocalError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Kiểm tra tính hợp lệ của giá trị hiện tại
  const validation = validateQuantity(value);
  const currentNum = validation.valid ? validation.value : undefined;

  const canDecrease = !disabled && currentNum !== undefined && currentNum > MIN_QUANTITY;
  const canIncrease = !disabled && currentNum !== undefined && currentNum < MAX_QUANTITY;

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validation.valid, validation.error);
    }
  }, [validation.valid, validation.error, onValidationChange]);

  const handleDecrease = useCallback(() => {
    if (disabled || !canDecrease) return;
    const next = decrementQuantity(value);
    onChangeValue(next);
    setLocalError(null);
  }, [disabled, canDecrease, value, onChangeValue]);

  const handleIncrease = useCallback(() => {
    if (disabled || !canIncrease) return;
    const next = incrementQuantity(value);
    onChangeValue(next);
    setLocalError(null);
  }, [disabled, canIncrease, value, onChangeValue]);

  const handleChangeText = useCallback(
    (text: string) => {
      // Cho phép người dùng tạm thời xóa trống để gõ số mới
      onChangeValue(text);
      if (text.trim() === '') {
        // Chưa báo lỗi ngay khi đang gõ rỗng, đợi blur
        setLocalError(null);
        return;
      }
      const check = validateQuantity(text);
      if (!check.valid) {
        setLocalError(check.error || 'Số lượng không hợp lệ');
      } else {
        setLocalError(null);
      }
    },
    [onChangeValue]
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const check = validateQuantity(value);
    if (!check.valid) {
      setLocalError(check.error || 'Vui lòng nhập số lượng hợp lệ (từ 1 đến 2.147.483.647)');
    } else {
      setLocalError(null);
      const normalized = normalizeQuantityOnCommit(value);
      if (normalized !== value) {
        onChangeValue(normalized);
      }
    }
  }, [value, onChangeValue]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Nhãn và Đơn vị bên trái */}
        <View style={styles.labelCol}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.unitBadge}>
            <Text style={styles.unitText}>Đơn vị: {unit}</Text>
          </View>
        </View>

        {/* Cụm Stepper [-] [Số] [+] bên phải */}
        <View style={styles.stepperGroup}>
          {/* Nút trừ */}
          <TouchableOpacity
            style={[
              styles.stepBtn,
              styles.minusBtn,
              (!canDecrease || disabled) && styles.btnDisabled,
            ]}
            onPress={handleDecrease}
            disabled={!canDecrease || disabled}
            activeOpacity={0.7}
            accessibilityLabel="Giảm số lượng"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canDecrease || disabled }}
          >
            <Minus
              size={20}
              color={!canDecrease || disabled ? '#A1A1AA' : Colors.hero}
            />
          </TouchableOpacity>

          {/* Ô nhập số lượng */}
          <View
            style={[
              styles.inputWrapper,
              isFocused && styles.inputWrapperFocused,
              localError ? styles.inputWrapperError : null,
              disabled && styles.inputDisabled,
            ]}
          >
            <TextInput
              style={styles.numberInput}
              value={value}
              onChangeText={handleChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={handleBlur}
              keyboardType="number-pad"
              returnKeyType="done"
              editable={!disabled}
              selectTextOnFocus
              maxLength={10}
              accessibilityLabel={`Số lượng, đơn vị ${unit}`}
            />
          </View>

          {/* Nút cộng */}
          <TouchableOpacity
            style={[
              styles.stepBtn,
              styles.plusBtn,
              (!canIncrease || disabled) && styles.btnDisabled,
            ]}
            onPress={handleIncrease}
            disabled={!canIncrease || disabled}
            activeOpacity={0.8}
            accessibilityLabel="Tăng số lượng"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canIncrease || disabled }}
          >
            <Plus
              size={20}
              color={!canIncrease || disabled ? '#A1A1AA' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Thông báo lỗi nếu có */}
      {!!localError && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>⚠️ {localError}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  labelCol: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  unitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  minusBtn: {
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  plusBtn: {
    backgroundColor: Colors.hero,
  },
  btnDisabled: {
    opacity: 0.35,
    backgroundColor: '#F4F4F5',
    borderColor: '#E4E4E7',
  },
  inputWrapper: {
    minWidth: 64,
    maxWidth: 100,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    ...Shadows.sm,
  },
  inputWrapperFocused: {
    borderColor: Colors.hero,
    borderWidth: 1.5,
  },
  inputWrapperError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
  },
  inputDisabled: {
    backgroundColor: '#F4F4F5',
    opacity: 0.6,
  },
  numberInput: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    width: '100%',
    padding: 0,
  },
  errorRow: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});
