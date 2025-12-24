import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { generateSHA256Hash } from "@/lib/utils";
import { api } from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, User, X } from "lucide-react";
import { useTranslation } from "next-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Disable2FA } from "./disable-2fa";
import { Enable2FA } from "./enable-2fa";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

const profileSchema = z.object({
	name: z.string(),
	email: z.string(),
	password: z.string().nullable(),
	currentPassword: z.string().nullable(),
	image: z.string().optional(),
	allowImpersonation: z.boolean().optional().default(false),
});

type Profile = z.infer<typeof profileSchema>;

const randomImages = [
	"/avatars/avatar-1.png",
	"/avatars/avatar-2.png",
	"/avatars/avatar-3.png",
	"/avatars/avatar-4.png",
	"/avatars/avatar-5.png",
	"/avatars/avatar-6.png",
	"/avatars/avatar-7.png",
	"/avatars/avatar-8.png",
	"/avatars/avatar-9.png",
	"/avatars/avatar-10.png",
	"/avatars/avatar-11.png",
	"/avatars/avatar-12.png",
];

export const ProfileForm = () => {
	const _utils = api.useUtils();
	const { data, refetch, isLoading } = api.user.get.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();

	const {
		mutateAsync,
		isLoading: isUpdating,
		isError,
		error,
	} = api.user.update.useMutation();
	const { t } = useTranslation("settings");
	const [gravatarHash, setGravatarHash] = useState<string | null>(null);
	const [uploadedImage, setUploadedImage] = useState<string | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const availableAvatars = useMemo(() => {
		if (gravatarHash === null) return randomImages;
		return randomImages.concat([
			`https://www.gravatar.com/avatar/${gravatarHash}`,
		]);
	}, [gravatarHash]);

	const form = useForm<Profile>({
		defaultValues: {
			name: data?.user?.name || "",
			email: data?.user?.email || "",
			password: "",
			image: data?.user?.image || "",
			currentPassword: "",
			allowImpersonation: data?.user?.allowImpersonation || false,
		},
		resolver: zodResolver(profileSchema),
	});

	// Check if current image is an uploaded image (base64 or not in predefined list)
	const isUploadedImage = useCallback((imageUrl: string | undefined) => {
		if (!imageUrl) return false;
		// Base64 images start with "data:"
		if (imageUrl.startsWith("data:")) return true;
		// Check if it's not a predefined avatar or gravatar
		const isPredefined = randomImages.includes(imageUrl);
		const isGravatar = imageUrl.includes("gravatar.com");
		return !isPredefined && !isGravatar;
	}, []);

	useEffect(() => {
		if (data) {
			const currentImage = data?.user?.image || "";
			
			// If the user has an uploaded image, set it to uploadedImage state
			if (isUploadedImage(currentImage)) {
				setUploadedImage(currentImage);
			}

			form.reset(
				{
					name: data?.user?.name || "",
					email: data?.user?.email || "",
					password: form.getValues("password") || "",
					image: currentImage,
					currentPassword: form.getValues("currentPassword") || "",
					allowImpersonation: data?.user?.allowImpersonation,
				},
				{
					keepValues: true,
				},
			);
			form.setValue("allowImpersonation", data?.user?.allowImpersonation);

			if (data.user.email) {
				generateSHA256Hash(data.user.email).then((hash) => {
					setGravatarHash(hash);
				});
			}
		}
	}, [form, data, isUploadedImage]);

	const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		setUploadError(null);

		if (!file) return;

		// Validate file type
		if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
			setUploadError("Please upload a valid image file (JPEG, PNG, GIF, or WebP)");
			return;
		}

		// Validate file size (2MB max)
		if (file.size > MAX_FILE_SIZE) {
			setUploadError("Image size must be less than 2MB");
			return;
		}

		// Convert to base64
		const reader = new FileReader();
		reader.onload = (e) => {
			const base64String = e.target?.result as string;
			setUploadedImage(base64String);
			form.setValue("image", base64String);
		};
		reader.onerror = () => {
			setUploadError("Failed to read file. Please try again.");
		};
		reader.readAsDataURL(file);

		// Reset file input so the same file can be selected again
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, [form]);

	const handleUploadClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleRemoveUploadedImage = useCallback(() => {
		setUploadedImage(null);
		setUploadError(null);
		// Reset to first predefined avatar
		form.setValue("image", randomImages[0]);
	}, [form]);

	const onSubmit = async (values: Profile) => {
		await mutateAsync({
			name: values.name,
			email: values.email.toLowerCase(),
			password: values.password || undefined,
			image: values.image,
			currentPassword: values.currentPassword || undefined,
			allowImpersonation: values.allowImpersonation,
		})
			.then(async () => {
				await refetch();
				toast.success("Profile Updated");
				form.reset({
					name: values.name,
					email: values.email,
					password: "",
					image: values.image,
					currentPassword: "",
				});
			})
			.catch(() => {
				toast.error("Error updating the profile");
			});
	};

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar  p-2.5 rounded-xl  max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md ">
					<CardHeader className="flex flex-row gap-2 flex-wrap justify-between items-center">
						<div>
							<CardTitle className="text-xl flex flex-row gap-2">
								<User className="size-6 text-muted-foreground self-center" />
								{t("settings.profile.title")}
							</CardTitle>
							<CardDescription>
								{t("settings.profile.description")}
							</CardDescription>
						</div>
						{!data?.user.twoFactorEnabled ? <Enable2FA /> : <Disable2FA />}
					</CardHeader>

					<CardContent className="space-y-2 py-8 border-t">
						{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
						{isLoading ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[35vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (
							<>
								<Form {...form}>
									<form
										onSubmit={form.handleSubmit(onSubmit)}
										className="grid gap-4"
									>
										<div className="space-y-4">
											<FormField
												control={form.control}
												name="name"
												render={({ field }) => (
													<FormItem>
														<FormLabel>{t("settings.profile.name")}</FormLabel>
														<FormControl>
															<Input
																placeholder={t("settings.profile.name")}
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="email"
												render={({ field }) => (
													<FormItem>
														<FormLabel>{t("settings.profile.email")}</FormLabel>
														<FormControl>
															<Input
																placeholder={t("settings.profile.email")}
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="currentPassword"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Current Password</FormLabel>
														<FormControl>
															<Input
																type="password"
																placeholder={t("settings.profile.password")}
																{...field}
																value={field.value || ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="password"
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t("settings.profile.password")}
														</FormLabel>
														<FormControl>
															<Input
																type="password"
																placeholder={t("settings.profile.password")}
																{...field}
																value={field.value || ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											<FormField
												control={form.control}
												name="image"
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t("settings.profile.avatar")}
														</FormLabel>
														<FormControl>
															<div className="space-y-3">
																{/* Hidden file input */}
																<input
																	ref={fileInputRef}
																	type="file"
																	accept={ACCEPTED_IMAGE_TYPES.join(",")}
																	onChange={handleFileUpload}
																	className="hidden"
																	aria-label="Upload profile picture"
																/>

																<RadioGroup
																	onValueChange={(e) => {
																		field.onChange(e);
																	}}
																	defaultValue={field.value}
																	value={field.value}
																	className="flex flex-row flex-wrap gap-2 max-xl:justify-center items-center"
																>
																	{/* Upload button */}
																	<div className="relative">
																		{uploadedImage ? (
																			<FormItem>
																				<FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:border-1 [&:has([data-state=checked])>div]:p-px cursor-pointer">
																					<FormControl>
																						<RadioGroupItem
																							value={uploadedImage}
																							className="sr-only"
																						/>
																					</FormControl>
																					<div className="relative h-12 w-12 rounded-full border hover:p-px hover:border-primary transition-transform overflow-hidden group">
																						<img
																							src={uploadedImage}
																							alt="Uploaded avatar"
																							className="h-full w-full object-cover"
																						/>
																						{/* Remove button overlay */}
																						<button
																							type="button"
																							onClick={(e) => {
																								e.preventDefault();
																								e.stopPropagation();
																								handleRemoveUploadedImage();
																							}}
																							className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
																							aria-label="Remove uploaded image"
																						>
																							<X className="h-4 w-4 text-white" />
																						</button>
																					</div>
																				</FormLabel>
																			</FormItem>
																		) : (
																			<button
																				type="button"
																				onClick={handleUploadClick}
																				className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:bg-muted/50 transition-all flex items-center justify-center cursor-pointer"
																				aria-label="Upload custom avatar"
																			>
																				<Upload className="h-5 w-5 text-muted-foreground" />
																			</button>
																		)}
																	</div>

																	{/* Predefined avatars */}
																	{availableAvatars.map((image) => (
																		<FormItem key={image}>
																			<FormLabel className="[&:has([data-state=checked])>img]:border-primary [&:has([data-state=checked])>img]:border-1 [&:has([data-state=checked])>img]:p-px cursor-pointer">
																				<FormControl>
																					<RadioGroupItem
																						value={image}
																						className="sr-only"
																					/>
																				</FormControl>

																				<img
																					key={image}
																					src={image}
																					alt="avatar"
																					className="h-12 w-12 rounded-full border hover:p-px hover:border-primary transition-transform"
																				/>
																			</FormLabel>
																		</FormItem>
																	))}
																</RadioGroup>

																{/* Upload error message */}
																{uploadError && (
																	<p className="text-sm text-destructive">
																		{uploadError}
																	</p>
																)}

																{/* Helper text */}
																<p className="text-xs text-muted-foreground">
																	Click the upload icon to add a custom avatar (max 2MB, JPEG/PNG/GIF/WebP)
																</p>
															</div>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											{isCloud && (
												<FormField
													control={form.control}
													name="allowImpersonation"
													render={({ field }) => (
														<FormItem className="flex flex-row items-center justify-between p-3 mt-4 border rounded-lg shadow-sm">
															<div className="space-y-0.5">
																<FormLabel>Allow Impersonation</FormLabel>
																<FormDescription>
																	Enable this option to allow Dokploy Cloud
																	administrators to temporarily access your
																	account for troubleshooting and support
																	purposes. This helps them quickly identify and
																	resolve any issues you may encounter.
																</FormDescription>
															</div>
															<FormControl>
																<Switch
																	checked={field.value}
																	onCheckedChange={field.onChange}
																/>
															</FormControl>
														</FormItem>
													)}
												/>
											)}
										</div>

										<div className="flex items-center justify-end gap-2">
											<Button type="submit" isLoading={isUpdating}>
												{t("settings.common.save")}
											</Button>
										</div>
									</form>
								</Form>
							</>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
