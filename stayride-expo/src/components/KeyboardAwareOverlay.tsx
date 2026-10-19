import React from 'react';
import { KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';

interface Props {
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Modal backdrops that hold inputs: lifts the card above the keyboard on both platforms.
// Android is edge-to-edge now, so the system will not resize the window for us.
export const KeyboardAwareOverlay: React.FC<Props> = ({ style, children }) => (
  <KeyboardAvoidingView style={style} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    {children}
  </KeyboardAvoidingView>
);
