#Group 8 Project

##### Clear memory
rm(list=ls())

#setwd("~/Spring 2025/Tuesday Predictive/Project")

##### Install and load required packages
#install.packages("dplyr")
library(dplyr)
library(data.table)

library(ggplot2)



logitdata <- fread("second_cleaned_data_logit_nooutliers.csv", sep=",",
                 na.strings=c("####", "", "NA"), header=TRUE,
                 stringsAsFactors = FALSE)


nooutlierdata <- fread("second_cleaned_data_logit_nooutliers.csv", sep=",",
               na.strings=c("####", "", "NA"), header=TRUE,
               stringsAsFactors = FALSE)

names(nooutlierdata)
if ("(Intercept)" %in% names(nooutlierdata)) {
  nooutlierdata <- nooutlierdata[, !(names(nooutlierdata) %in% "(Intercept)"), with = FALSE]
}
#Logistic regression using all variables except bweight
model_logit <- glm(low_birthweight ~ . - bweight, 
                   data = nooutlierdata, 
                   family = "binomial")

summary(model_logit)

# Extract model summary coefficients
coefs <- summary(model_logit)$coefficients

# Convert to data frame
coefs_df <- as.data.frame(coefs)
coefs_df$Variable <- rownames(coefs_df)

# Rename columns
colnames(coefs_df) <- c("Estimate", "StdError", "z_value", "p_value", "Variable")

# Calculate Odds Ratio and 95% Confidence Interval
coefs_df$OddsRatio <- exp(coefs_df$Estimate)
coefs_df$CI_lower <- exp(coefs_df$Estimate - 1.96 * coefs_df$StdError)
coefs_df$CI_upper <- exp(coefs_df$Estimate + 1.96 * coefs_df$StdError)

# Filter only significant features (p-value < 0.05 and not Intercept)
significant_vars <- coefs_df %>%
  filter(p_value < 0.1 & Variable != "(Intercept)") %>%
  arrange(p_value)

# View significant features with odds ratio
print(significant_vars[, c("Variable", "Estimate", "OddsRatio", "CI_lower", "CI_upper", "p_value")])




# Step 1: Create a named vector for labels
pretty_names <- c(
  "hispmomCuban" = "Hispanic Mother (Cuban)",
  "eclamp" = "Eclampsia",
  "racemomChinese" = "Mother's Race: Chinese",
  "hydram" = "Hydramnios",
  "uterine" = "Uterine Abnormality",
  "preterm" = "Preterm History",
  "renal" = "Renal Disease",
  "cervix" = "Cervical Incompetence",
  "hyperpr" = "Pregnancy-Induced Hypertension",
  "hemoglob" = "Low Hemoglobin",
  "hyperch" = "Chronic Hypertension",
  "loutcome_unknown" = "Unknown Last Pregnancy Outcome",
  "aclung" = "Acute Lung Disease",
  "terms" = "Prior Terminations",
  "cignum" = "Avg. Cigarettes per Day",
  "mother_education" = "Mother's Education",
  "weight_gained" = "Weight Gained During Pregnancy",
  "father_education" = "Father's Education",
  "mother_married" = "Mother is Married",
  "diabetes" = "Diabetes",
  "baby_male" = "Baby is Male",
  "racedadWhite" = "Father's Race: White",
  "racedadOther_Non_White" = "Father's Race: Other Non-White",
  "racedadBlack" = "Father's Race: Black",
  "weeks" = "Gestation Weeks",
  "rhsen" = "RH Sensitization",
  "hispdadCuban" = "Hispanic Father (Cuban)",
  "hispdadPeruvian" = "Hispanic Father (Peruvian)",
  "pinfant" = "Previous Infant Death",
  "hispdadMexican" = "Hispanic Father (Mexican)",
  "hispdadNot_Hispanic" = "Father Not Hispanic",
  "hispdadSalvadoran" = "Hispanic Father (Salvadoran)",
  "hispdadGuatemalan" = "Hispanic Father (Guatemalan)",
  "hispmomMexican" = "Hispanic Mom (Mexican)"
)

# Step 2: Replace the variable names
significant_vars$Label <- pretty_names[significant_vars$Variable]



# Step 2: Add a "PrettyName" column to the dataframe
significant_vars$PrettyName <- pretty_names[significant_vars$Variable]

# Step 3: View as needed
print(significant_vars[, c("PrettyName", "Variable", "OddsRatio", "Estimate", "CI_lower", "CI_upper", "p_value")])

# Optional simpler view for table
print(significant_vars[, c("PrettyName", "OddsRatio")])



# Bar chart of odds ratios (use PrettyName for x-axis)


ggplot(significant_vars, aes(x = reorder(PrettyName, OddsRatio), y = OddsRatio)) +
  geom_bar(stat = "identity", fill = "steelblue") +
  geom_hline(yintercept = 1, linetype = "solid", color = "red", size = 1) +
  geom_text(aes(label = sprintf("%.2f", OddsRatio)), hjust = -0.1, size = 3)+# 🔴 Red line at OR=1
  coord_flip() +
  scale_y_continuous(limits = c(0, 8)) +  # Optional: cap axis at OR = 15
  labs(
    title = "Odds Ratios of Predictors for Low Birth Weight",
    subtitle = "Red dashed line shows no-effect threshold (OR = 1)",
    x = "Predictor Variable",
    y = "Odds Ratio"
  ) +
  theme_minimal(base_size = 12)



# Step 1: Extract model summary
coefs <- summary(model_logit)$coefficients
coefs_df <- as.data.frame(coefs)
coefs_df$Variable <- rownames(coefs_df)
colnames(coefs_df) <- c("Estimate", "StdError", "z_value", "p_value", "Variable")

# Step 2: Add Odds Ratio
coefs_df$OddsRatio <- exp(coefs_df$Estimate)

# Step 3: Filter significant variables
sig_vars <- subset(coefs_df, p_value < 0.05 & Variable != "(Intercept)")

# Step 4: Compute log(OR) for divergence
sig_vars$logOR <- log(sig_vars$OddsRatio)

# Step 5: Label effect type
sig_vars$EffectType <- ifelse(sig_vars$logOR > 0, "Risk Factor", "Protective Factor")




# Step 7: Apply pretty names to new column
sig_vars$PrettyName <- ifelse(sig_vars$Variable %in% names(pretty_names),
                              pretty_names[sig_vars$Variable],
                              sig_vars$Variable)


  

top_10_predictors <- sig_vars %>%
  arrange(desc(abs(logOR))) %>%
  head(10)

# View Top 10
print(top_10_predictors[, c("PrettyName", "Variable", "OddsRatio", "Estimate")])


# Step 2: Plot the Top 10 predictors
library(ggplot2)

ggplot(top_10_predictors, aes(x = reorder(PrettyName, OddsRatio), y = OddsRatio, fill = EffectType)) +
  geom_bar(stat = "identity", width = 0.6) +
  geom_hline(yintercept = 1, linetype = "solid", color = "red") +  # OR = 1 reference line
  geom_text(aes(label = sprintf("%.2f", OddsRatio)),   # Add odds ratio label
            hjust = -0.1, size = 3) +                   # Slightly outside the bar
  scale_fill_manual(values = c("Risk Factor" = "salmon", "Protective Factor" = "skyblue")) +
  coord_flip() +
  labs(
    title = "Top 10 Predictors for Low Birth Weight",
    subtitle = "Odds Ratios with Direction of Effect",
    x = "Predictor Variable",
    y = "Odds Ratio",
    fill = "Effect Type"
  ) +
  theme_minimal(base_size = 13) +
  theme(
    axis.text.x = element_text(size = 11),
    axis.text.y = element_text(size = 11),
    plot.title = element_text(face = "bold", size = 15),
    plot.subtitle = element_text(size = 12),
    legend.position = "none"      # 🔥 This line removes the legend!
  ) +
  scale_y_continuous(expand = expansion(mult = c(0, 0.15)))


