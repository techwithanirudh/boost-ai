import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  message: z
    .string()
    .min(3, "Message must be at least 3 characters.")
    .max(400, "Message must be at most 400 characters."),
});

export type NewTaskFormValues = z.infer<typeof formSchema>;

export function NewTaskForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (
    values: NewTaskFormValues,
    reset: () => void
  ) => void | Promise<void>;
}) {
  const form = useForm<NewTaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
    mode: "onChange",
  });

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values, () => form.reset());
      })}
    >
      <FieldGroup>
        <Controller
          control={form.control}
          name="message"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="task">Task</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                autoComplete="off"
                autoFocus
                id="task"
                placeholder="e.g. move forward slowly and inspect nearby objects"
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Field orientation="horizontal">
          <Button
            disabled={isSubmitting || form.formState.isSubmitting}
            type="submit"
          >
            Start
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
