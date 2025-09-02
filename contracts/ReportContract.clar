;; ReportContract.clar
;; This contract manages the submission and storage of immutable sustainability reports for tech complaints.
;; It ensures reports are tamper-proof, categorized, and queryable.
;; Features include: report submission, detailed querying, categorization, status tracking, collaborator management,
;; and integration points for resolutions and rewards.

;; Constants
(define-constant ERR-ALREADY-REGISTERED u1)
(define-constant ERR-UNAUTHORIZED u2)
(define-constant ERR-INVALID-PARAM u3)
(define-constant ERR-NOT-FOUND u4)
(define-constant MAX-TITLE-LEN u100)
(define-constant MAX-DESCRIPTION-LEN u1000)
(define-constant MAX-CATEGORY-LEN u50)
(define-constant MAX-TAGS u10)
(define-constant MAX-TAG-LEN u20)
(define-constant MAX-COLLABORATORS u5)

;; Data Structures
(define-map reports
  { report-id: uint }
  {
    owner: principal,
    timestamp: uint,
    title: (string-utf8 100),
    description: (string-utf8 1000),
    category: (string-utf8 50),
    tags: (list 10 (string-utf8 20)),
    status: (string-utf8 20), ;; e.g., "open", "resolved", "disputed"
    eco-impact-estimate: uint, ;; Estimated CO2 savings or similar metric
    visibility: bool ;; Public or private
  }
)

(define-map report-counter principal uint) ;; Per-user report count for ID generation

(define-map report-collaborators
  { report-id: uint, collaborator: principal }
  {
    role: (string-utf8 50),
    permissions: (list 5 (string-utf8 20)), ;; e.g., ["view", "comment"]
    added-at: uint
  }
)

(define-map report-history
  { report-id: uint, version: uint }
  {
    updated-by: principal,
    changes: (string-utf8 500),
    timestamp: uint
  }
)

(define-map report-attachments
  { report-id: uint, attachment-id: uint }
  {
    hash: (buff 32), ;; IPFS hash or similar
    description: (string-utf8 200),
    added-by: principal,
    timestamp: uint
  }
)

(define-map report-metrics
  { report-id: uint }
  {
    views: uint,
    upvotes: uint,
    downvotes: uint,
    resolution-attempts: uint
  }
)

;; Private Functions
(define-private (generate-report-id (owner principal))
  (let ((current-count (default-to u0 (map-get? report-counter owner))))
    (map-set report-counter owner (+ current-count u1))
    (+ (* (unwrap-panic (principal-to-uint owner)) u1000000) current-count) ;; Simplified unique ID
  )
)

(define-private (principal-to-uint (p principal))
  ;; Placeholder: In real Clarity, use var-get or other for unique seeding
  u1 ;; Mock for now; extend as needed
)

(define-private (validate-string-len (s (string-utf8 1000)) (max-len uint))
  (<= (len s) max-len)
)

(define-private (is-owner-or-collaborator (report-id uint) (user principal) (permission (string-utf8 20)))
  (or (is-eq user (get owner (unwrap! (map-get? reports {report-id: report-id}) (err ERR-NOT-FOUND))))
      (match (map-get? report-collaborators {report-id: report-id, collaborator: user})
        collab (is-some (index-of (get permissions collab) permission))
        false))
)

;; Public Functions
(define-public (submit-report 
  (title (string-utf8 100)) 
  (description (string-utf8 1000)) 
  (category (string-utf8 50)) 
  (tags (list 10 (string-utf8 20))) 
  (eco-impact-estimate uint)
  (visibility bool))
  (begin
    (asserts! (validate-string-len title MAX-TITLE-LEN) (err ERR-INVALID-PARAM))
    (asserts! (validate-string-len description MAX-DESCRIPTION-LEN) (err ERR-INVALID-PARAM))
    (asserts! (validate-string-len category MAX-CATEGORY-LEN) (err ERR-INVALID-PARAM))
    (asserts! (<= (len tags) MAX-TAGS) (err ERR-INVALID-PARAM))
    (fold (lambda (tag acc) (and acc (<= (len tag) MAX-TAG-LEN))) tags true)
    (let ((report-id (generate-report-id tx-sender)))
      (asserts! (is-none (map-get? reports {report-id: report-id})) (err ERR-ALREADY-REGISTERED))
      (map-set reports
        {report-id: report-id}
        {
          owner: tx-sender,
          timestamp: block-height,
          title: title,
          description: description,
          category: category,
          tags: tags,
          status: "open",
          eco-impact-estimate: eco-impact-estimate,
          visibility: visibility
        }
      )
      (map-set report-metrics {report-id: report-id} {views: u0, upvotes: u0, downvotes: u0, resolution-attempts: u0})
      (ok report-id)
    )
  )
)

(define-public (add-collaborator 
  (report-id uint) 
  (collaborator principal) 
  (role (string-utf8 50)) 
  (permissions (list 5 (string-utf8 20))))
  (let ((report (unwrap! (map-get? reports {report-id: report-id}) (err ERR-NOT-FOUND))))
    (asserts! (is-eq tx-sender (get owner report)) (err ERR-UNAUTHORIZED))
    (asserts! (<= (len permissions) u5) (err ERR-INVALID-PARAM))
    (asserts! (is-none (map-get? report-collaborators {report-id: report-id, collaborator: collaborator})) (err ERR-ALREADY-REGISTERED))
    (map-set report-collaborators
      {report-id: report-id, collaborator: collaborator}
      {
        role: role,
        permissions: permissions,
        added-at: block-height
      }
    )
    (ok true)
  )
)

(define-public (update-status (report-id uint) (new-status (string-utf8 20)))
  (let ((report (unwrap! (map-get? reports {report-id: report-id}) (err ERR-NOT-FOUND))))
    (asserts! (is-owner-or-collaborator report-id tx-sender "update-status") (err ERR-UNAUTHORIZED))
    (map-set reports {report-id: report-id} (merge report {status: new-status}))
    (ok true)
  )
)

(define-public (add-attachment (report-id uint) (hash (buff 32)) (description (string-utf8 200)))
  (begin
    (asserts! (is-some (map-get? reports {report-id: report-id})) (err ERR-NOT-FOUND))
    (asserts! (is-owner-or-collaborator report-id tx-sender "add-attachment") (err ERR-UNAUTHORIZED))
    (let ((attachment-id (+ (default-to u0 (map-get? report-counter tx-sender)) u1))) ;; Reuse counter for attachments
      (map-set report-attachments {report-id: report-id, attachment-id: attachment-id}
        {hash: hash, description: description, added-by: tx-sender, timestamp: block-height})
      (ok attachment-id)
    )
  )
)

(define-public (record-history (report-id uint) (changes (string-utf8 500)) (version uint))
  (begin
    (asserts! (is-some (map-get? reports {report-id: report-id})) (err ERR-NOT-FOUND))
    (asserts! (is-owner-or-collaborator report-id tx-sender "record-history") (err ERR-UNAUTHORIZED))
    (map-set report-history {report-id: report-id, version: version}
      {updated-by: tx-sender, changes: changes, timestamp: block-height})
    (ok true)
  )
)

(define-public (upvote-report (report-id uint))
  (let ((metrics (unwrap! (map-get? report-metrics {report-id: report-id}) (err ERR-NOT-FOUND))))
    (asserts! (get visibility (unwrap! (map-get? reports {report-id: report-id}) (err ERR-NOT-FOUND))) (err ERR-UNAUTHORIZED)) ;; Only public
    (map-set report-metrics {report-id: report-id} (merge metrics {upvotes: (+ (get upvotes metrics) u1)}))
    (ok true)
  )
)

(define-public (downvote-report (report-id uint))
  (let ((metrics (unwrap! (map-get? report-metrics {report-id: report-id}) (err ERR-NOT-FOUND))))
    (asserts! (get visibility (unwrap! (map-get? reports {report-id: report-id}) (err ERR-NOT-FOUND))) (err ERR-UNAUTHORIZED))
    (map-set report-metrics {report-id: report-id} (merge metrics {downvotes: (+ (get downvotes metrics) u1)}))
    (ok true)
  )
)

(define-public (increment-view (report-id uint))
  (let ((metrics (unwrap! (map-get? report-metrics {report-id: report-id}) (err ERR-NOT-FOUND))))
    (asserts! (or (is-owner-or-collaborator report-id tx-sender "view") (get visibility (unwrap! (map-get? reports {report-id: report-id}) (err ERR-NOT-FOUND)))) (err ERR-UNAUTHORIZED))
    (map-set report-metrics {report-id: report-id} (merge metrics {views: (+ (get views metrics) u1)}))
    (ok true)
  )
)

(define-public (increment-resolution-attempt (report-id uint))
  (let ((metrics (unwrap! (map-get? report-metrics {report-id: report-id}) (err ERR-NOT-FOUND))))
    (asserts! (is-owner-or-collaborator report-id tx-sender "update-metrics") (err ERR-UNAUTHORIZED))
    (map-set report-metrics {report-id: report-id} (merge metrics {resolution-attempts: (+ (get resolution-attempts metrics) u1)}))
    (ok true)
  )
)

;; Read-Only Functions
(define-read-only (get-report (report-id uint))
  (map-get? reports {report-id: report-id})
)

(define-read-only (get-report-metrics (report-id uint))
  (map-get? report-metrics {report-id: report-id})
)

(define-read-only (get-report-collaborator (report-id uint) (collaborator principal))
  (map-get? report-collaborators {report-id: report-id, collaborator: collaborator})
)

(define-read-only (get-report-history (report-id uint) (version uint))
  (map-get? report-history {report-id: report-id, version: version})
)

(define-read-only (get-report-attachment (report-id uint) (attachment-id uint))
  (map-get? report-attachments {report-id: report-id, attachment-id: attachment-id})
)

(define-read-only (get-user-report-count (user principal))
  (default-to u0 (map-get? report-counter user))
)