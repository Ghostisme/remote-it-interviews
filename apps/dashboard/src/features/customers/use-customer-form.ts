import { errorMessage, useCreateCustomer, useUpdateCustomer } from "@odyssey/api-client";
import type { CreateCustomer, Customer } from "@odyssey/types";
import { useToast } from "@odyssey/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function useCustomerForm(customer: Customer | undefined, onSaved: (id: string) => void) {
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [error, setError] = useState("");
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const client = useQueryClient();
  const toast = useToast();
  const submit = async () => {
    setError("");
    if (name.trim().length < 2)
      return setError("Enter a customer name with at least 2 characters.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("Enter a valid email, or leave it blank.");
    if (phone.trim() && phone.trim().length < 5)
      return setError("Enter a phone number with at least 5 characters, or leave it blank.");
    const data: CreateCustomer = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim(),
    };
    try {
      const result = customer
        ? await update.mutateAsync({ id: customer.id, data })
        : await create.mutateAsync({ data });
      await client.invalidateQueries();
      toast(customer ? "Guest details updated." : "A warm welcome to your newest guest.");
      onSaved(result.id);
    } catch (e) {
      setError(errorMessage(e));
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
    saving: create.isPending || update.isPending,
  };
}
