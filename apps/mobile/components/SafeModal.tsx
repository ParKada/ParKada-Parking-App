import React from 'react';
import { Modal as RNModal, ModalProps } from 'react-native';

export function Modal(props: ModalProps) {
  if (!props.visible) return null;
  return <RNModal {...props} visible={true} />;
}
