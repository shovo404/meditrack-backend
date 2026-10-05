<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Password reset notification for token-based (mobile) clients.
 *
 * Laravel's stock `ResetPassword` notification builds a link to a named
 * `password.reset` web route. MediTrack has no web route and its clients are
 * bearer-token API consumers, so the raw reset token is delivered instead and
 * the client exchanges it for a new credential.
 *
 * The token is minted by Laravel's password broker, which is what actually
 * stores and validates it, so this notification is a transport detail and never
 * the source of truth for the reset.
 */
class PasswordResetNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $token,
        private readonly string $email,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Reset your MediTrack password')
            ->line('A password reset was requested for your MediTrack account.')
            ->line('Use the following token in the app to choose a new password:')
            ->line($this->token)
            ->line('This token expires in 60 minutes.')
            ->line('If you did not request a password reset, no further action is required.');
    }

    /**
     * Never expose the reset token through the notification payload itself.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'email' => $this->email,
        ];
    }
}
