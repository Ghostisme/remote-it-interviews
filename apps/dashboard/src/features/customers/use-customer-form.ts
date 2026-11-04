import { errorMessage, useCreateCustomer, useUpdateCustomer } from "@odyssey/api-client";
import type { CreateCustomer, Customer } from "@odyssey/types";
import { useToast } from "@odyssey/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/** Validate a guest profile and refresh views that display customer identities. */
export function useCustomerForm(
  customer: Customer | undefined,
  onSaved: (customerId: string) => void,
) {
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [error, setError] = useState("");
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const queryClient = useQueryClient();
  const toast = useToast();
  /** Validate and normalize guest contact details before creating or updating the customer. */
  const submit = async () => {
    setError("");
    if (name.trim().length < 2)
      return setError("Enter a customer name with at least 2 characters.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("Enter a valid email, or leave it blank.");
    if (phone.trim() && phone.trim().length < 5)
      return setError("Enter a phone number with at least 5 characters, or leave it blank.");
    // Persist absent optional contacts as null rather than blank addresses.
    const customerPayload: CreateCustomer = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim(),
    };
    try {
      const result = customer
        ? await updateCustomerMutation.mutateAsync({ id: customer.id, data: customerPayload })
        : await createCustomerMutation.mutateAsync({ data: customerPayload });
      await queryClient.invalidateQueries();
      toast(customer ? "Guest details updated." : "A warm welcome to your newest guest.");
      onSaved(result.id);
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return {
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    notes,
    setNotes,
    error,
    submit,
    saving: createCustomerMutation.isPending || updateCustomerMutation.isPending,
  };
}
