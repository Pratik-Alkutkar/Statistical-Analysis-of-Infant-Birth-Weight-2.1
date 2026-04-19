#Group 8 Project

##### Clear memory
rm(list=ls())

#setwd("~/Spring 2025/Tuesday Predictive/Project")

##### Install and load required packages
#install.packages("dplyr")
library(dplyr)
library(data.table)

#Part A: Loading the baby-weights-dataset.csv data file
data <- fread("baby-weights-dataset.csv", sep=",",
                 na.strings=c("####", "", "NA"), header=TRUE,
                 stringsAsFactors = FALSE)

#How many customers are in the data (i.e., the total number of rows) & how many variables?
dim(data)
#101400 rows & 37 columns

#Different attribute names
names(data)

#Converting all headers into lowercase for ease
names(data) <- tolower(names(data))
names(data)

summary(data)

#Create an empty data frame to store cleaned columns
#Initialize clean_data with same number of rows
clean_data <- data.frame(row_id = 1:nrow(data))

#sex
table(data$sex)
# Create baby_male column
clean_data$baby_male <- ifelse(data$sex == 1, 1,
                               ifelse(data$sex == 2, 0, NA))
summary(clean_data$baby_male)

#marital
table(data$marital)
clean_data$mother_married <- ifelse(data$marital == 1, 1,
                                    ifelse(data$marital == 2, 0, NA))
summary(clean_data$mother_married)

#Fatherage
table(data$fage)
clean_data$father_age <- data$fage
summary(clean_data$father_age)

#Motherage
table(data$mage)
clean_data$mother_age <- data$mage
summary(clean_data$mother_age)

#Fathereducation
table(data$feduc)
clean_data$father_education <- data$feduc
summary(clean_data$father_education)

#Mothereducation
table(data$meduc)
clean_data$mother_education <- data$meduc
summary(clean_data$mother_education)

#Weight gained during pregnancy
table(data$gained)
clean_data$weight_gained <- data$gained
summary(clean_data$weight_gained)

#Number of Prenatal Visits
table(data$visits)
clean_data$visits <- data$visits
summary(clean_data$visits)

#Total Pregnancies
table(data$totalp)
clean_data$totalp <- data$totalp
summary(clean_data$totalp)

#Bdead -> converting to binary variable of child loss
table(data$bdead)
clean_data$child_loss <- ifelse(data$bdead > 0, 1, 0)
table(clean_data$child_loss)

#number of other terminations
table(data$terms)
clean_data$terms <- data$terms
summary(clean_data$terms)

#Loutcome - converting to categorical variable of loutcome
table(data$loutcome)

data$stillbirth_group <- factor(data$loutcome,
                                levels = c(1, 2, 9),
                                labels = c("LiveBirth", "Stillbirth", "Unknown"))

stillbirth_dummies <- model.matrix(~ stillbirth_group, data = data)[, -1]
colnames(stillbirth_dummies) <- c("loutcome_stillbirth", "loutcome_unknown")

# Add to clean_data
clean_data <- cbind(clean_data, stillbirth_dummies)
colnames(clean_data)[grepl("loutcome", colnames(clean_data))]

table(clean_data$loutcome_stillbirth)
table(clean_data$loutcome_unknown)
#there are 34513 unknown outcomes

#completed weeks of gestation
table(data$weeks)
clean_data$weeks <- data$weeks
table(clean_data$weeks)

#Avg Number of cigerrates mother used daily
table(data$cignum)
clean_data$cignum <- data$cignum
summary(clean_data$cignum)

#Avg Number of drinks mother used daily
table(data$drinknum)
clean_data$drinknum <- data$drinknum
summary(clean_data$drinknum)

#to check if they all follow 0 = No, 1 = Yes
lapply(data[, c("anemia", "cardiac", "aclung", "diabetes", "herpes", "hydram",
                "hemoglob", "hyperch", "hyperpr", "eclamp", "cervix", "pinfant", 
                "preterm", "renal", "rhsen", "uterine")], table)

#adding anemia to uterine into the clean data
# Get column positions for the range
start_col <- which(names(data) == "anemia")
end_col <- which(names(data) == "uterine")

# Add columns from anemia to uterine to clean_data
clean_data <- cbind(clean_data, data[, start_col:end_col])

race_labels <- c(
  "Unknown", "Other_Non_White", "White", "Black", 
  "American_Indian", "Chinese", "Japanese", 
  "Hawaiian", "Filipino", "Other_Asian"
)

# Convert to labeled factors
data$racemom <- factor(data$racemom, levels = 0:9, labels = race_labels)
data$racedad <- factor(data$racedad, levels = 0:9, labels = race_labels)
# Now relevel to set "Other_Asian" as reference
data$racemom <- relevel(data$racemom, ref = "Other_Asian")
data$racedad <- relevel(data$racedad, ref = "Other_Asian")
# Create dummy variables (dropping intercept)
race_mom_dummies <- model.matrix(~ racemom , data = data)
race_dad_dummies <- model.matrix(~ racedad , data = data)

clean_data <- cbind(clean_data, race_mom_dummies, race_dad_dummies)

#hispanic
# Define labels
hispanic_labels <- c(
  "C" = "Cuban",
  "M" = "Mexican",
  "O" = "Colombian",
  "P" = "Peruvian",
  "S" = "Salvadoran",
  "U" = "Guatemalan",
  "N" = "Not_Hispanic"
)

# Apply labels
data$hispmom <- factor(data$hispmom, levels = names(hispanic_labels), labels = hispanic_labels)
data$hispdad <- factor(data$hispdad, levels = names(hispanic_labels), labels = hispanic_labels)

data$hispmom <- relevel(data$hispmom, ref = "Not_Hispanic")
data$hispdad <- relevel(data$hispdad, ref = "Not_Hispanic")
# Create dummy variables (no intercept)
hisp_mom_dummies <- model.matrix(~ hispmom , data = data)
hisp_dad_dummies <- model.matrix(~ hispdad , data = data)

clean_data <- cbind(clean_data, hisp_mom_dummies, hisp_dad_dummies)
table(rowSums(hisp_mom_dummies))  # Should be 1 for most rows
table(rowSums(hisp_dad_dummies))

clean_data$row_id <- NULL

#For logistic dataset
table(data$bweight)
clean_data$low_birthweight <- ifelse(data$bweight < 5.5, 1, 0)
table(clean_data$low_birthweight)

#logistic regression data
clean_data_logit <- clean_data
clean_data_logit$bweight <- data$bweight
fwrite(clean_data_logit, "cleaned_data_logistic.csv")


#Define the columns where you want to remove outliers
#outlier_cols <- c("father_age", "mother_age", "father_education", "mother_education",
               #   "weight_gained", "visits", "totalp", "terms", "weeks", "cignum", "drinknum")

#Define the outlier removal function using IQR method
#Define numeric columns where you want to remove outliers
#outlier_cols <- c("father_age", "mother_age", "father_education", "mother_education",
                #   "visits", "totalp", "terms", "weeks", "cignum", "drinknum")

#Define the function to remove outliers using IQR
remove_outliers_iqr <- function(df, cols) {
  for (col in cols) {
    Q1 <- quantile(df[[col]], 0.25, na.rm = TRUE)
    Q3 <- quantile(df[[col]], 0.75, na.rm = TRUE)
    IQR_val <- Q3 - Q1
    lower <- Q1 - 1.5 * IQR_val
    upper <- Q3 + 1.5 * IQR_val
    df <- df[df[[col]] >= lower & df[[col]] <= upper, ]
  }
  return(df)
}
dim(clean_data_logit)

# Apply the function to clean_data_logit
#clean_data_logit_nooutliers <- remove_outliers_iqr(clean_data_logit, outlier_cols)

#dim(clean_data_logit_nooutliers)
# Save the new file
#fwrite(clean_data_logit_nooutliers, "cleaned_data_logit_nooutliers.csv")


second_outlier_cols <- c("father_age", "mother_age", 
                         "totalp", "bweight")

# Apply the function to clean_data_logit
second_clean_data_logit_nooutliers <- remove_outliers_iqr(clean_data_logit, second_outlier_cols)

dim(second_clean_data_logit_nooutliers)
# Save the new file
fwrite(second_clean_data_logit_nooutliers, "second_cleaned_data_logit_nooutliers.csv")


