import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";

const ModalContext = createContext(null);

export function useModal() {
  return useContext(ModalContext);
}

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const dismiss = useCallback(() => setModal(null), []);

  const showAlert = useCallback((title, message) => {
    return new Promise((resolve) => {
      setModal({
        type: "alert",
        title,
        message,
        onDismiss: () => { dismiss(); resolve(); },
      });
    });
  }, [dismiss]);

  const showConfirm = useCallback((title, message, { confirmText = "Confirm", destructive = false } = {}) => {
    return new Promise((resolve) => {
      setModal({
        type: "confirm",
        title,
        message,
        confirmText,
        destructive,
        onConfirm: () => { dismiss(); resolve(true); },
        onCancel: () => { dismiss(); resolve(false); },
      });
    });
  }, [dismiss]);

  const showPrompt = useCallback((title, message, { submitText = "Submit", defaultValue = "", keyboardType = "default", destructive = false } = {}) => {
    return new Promise((resolve) => {
      setModal({
        type: "prompt",
        title,
        message,
        submitText,
        defaultValue,
        keyboardType,
        destructive,
        onSubmit: (value) => { dismiss(); resolve(value); },
        onCancel: () => { dismiss(); resolve(null); },
      });
    });
  }, [dismiss]);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      {modal && <ModalOverlay modal={modal} />}
    </ModalContext.Provider>
  );
}

function ModalOverlay({ modal }) {
  if (modal.type === "alert") return <AlertModal {...modal} />;
  if (modal.type === "confirm") return <ConfirmModalView {...modal} />;
  if (modal.type === "prompt") return <PromptModal {...modal} />;
  return null;
}

function AlertModal({ title, message, onDismiss }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.okBtn} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.okTxt}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmModalView({ title, message, confirmText, destructive, onConfirm, onCancel }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, destructive && styles.destructiveBtn]} onPress={onConfirm} activeOpacity={0.7}>
              <Text style={styles.confirmTxt}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PromptModal({ title, message, submitText, defaultValue, keyboardType, destructive, onSubmit, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType={keyboardType}
            autoFocus
            placeholderTextColor="#666"
            selectionColor="#7c5cbf"
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, destructive && styles.destructiveBtn]} onPress={() => onSubmit(value)} activeOpacity={0.7}>
              <Text style={styles.confirmTxt}>{submitText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#1a1a2e",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2a40",
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f1c40f",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#0d0d1a",
    borderWidth: 1,
    borderColor: "#2a2a40",
    borderRadius: 8,
    color: "#e0e0e0",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  row: { flexDirection: "row", gap: 10 },
  okBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#3498db",
    alignItems: "center",
  },
  okTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a40",
    alignItems: "center",
  },
  cancelTxt: { color: "#aaa", fontWeight: "600", fontSize: 14 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#3498db",
    alignItems: "center",
  },
  destructiveBtn: { backgroundColor: "#c0392b" },
  confirmTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
