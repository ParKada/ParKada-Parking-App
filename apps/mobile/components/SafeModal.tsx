import React from 'react';
import { View, ModalProps, StyleSheet, TouchableWithoutFeedback } from 'react-native';

export function Modal(props: ModalProps) {
  if (!props.visible) return null;
  
  return (
    <View style={StyleSheet.absoluteFill} style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, elevation: 9999 }]}>
      {props.children}
    </View>
  );
}
