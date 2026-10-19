import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps } from 'react-native';

// Scrolling form that stays visible above the keyboard on Android and iOS.
// Android is edge-to-edge, so the window is not resized by the system and the view must do it.
export const FormScroll: React.FC<ScrollViewProps> = ({ children, ...props }) => (
  <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      {...props}
    >
      {children}
    </ScrollView>
  </KeyboardAvoidingView>
);
